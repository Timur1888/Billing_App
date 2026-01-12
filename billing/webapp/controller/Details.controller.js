sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/PDFViewer",
    "billing/util/Details_PDFViewHelper"
], (Controller, UIComponent, Fragment, JSONModel, PDFViewer, Details_PDFViewHelper) => {
    "use strict";

    return Controller.extend("billing.controller.Details", {
        onInit() {
            // Upload-Model
            var oUploadModel = new JSONModel({
                invoiceFiles: [],
                attachments: []
            });
            this.getView().setModel(oUploadModel, "upload");

            // Template-Model für Dialog
            var oTemplateModel = new JSONModel({
                subject: "",
                body: "",
                languages: [
                    { key: "de", name: "German",  selected: true  },
                    { key: "en", name: "English", selected: false },
                    { key: "fr", name: "French",  selected: false },
                    { key: "es", name: "Spanish", selected: false }
                ]
            });
            this.getView().setModel(oTemplateModel, "template");

            // ✅ PDFViewer wie im UI5 Sample (einmalig)
            this._oPdfViewer = new PDFViewer({
                isTrustedSource: true,
                showDownloadButton: true
            });
            this.getView().addDependent(this._oPdfViewer);

            const oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("DetailsRoute").attachPatternMatched(this._onRouteMatched, this);
        },

  //---------------------------------------------------------------------------------------------------Edit Templates----------------------------------------------------------------
        onEditTemplate: function () {
            // Dialog lazy laden
            if (!this._oTemplateDialog) {
                Fragment.load({
                    name: "billing.view.MessageTemplateDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oTemplateDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oTemplateDialog.open();
            }
        },

        onTemplateDialogCancel: function () {
            if (this._oTemplateDialog) {
                this._oTemplateDialog.close();
            }
        },

        onTemplateDialogSave: function () {
            // Hier später: Template speichern / Backend-Call etc.
            // Aktuell schließen wir nur den Dialog.
            if (this._oTemplateDialog) {
                this._oTemplateDialog.close();
            }
        },


    _onRouteMatched: function (oEvent) {
        const sInvoiceId = oEvent.getParameter("arguments").invoiceId;

        // Layout sicherstellen (falls du mainView im Details auch hast)
        const oMainViewModel = this.getView().getModel("mainView");
        if (oMainViewModel) {
            oMainViewModel.setProperty("/layout", "TwoColumnsBeginExpanded");
        }

        // ✅ Backend-Model holen (aus Component ist am sichersten)
        const oModel = this.getOwnerComponent().getModel("backend");
        if (!oModel) {
            console.error("Model 'backend' nicht gefunden");
            return;
        }

        const aInvoices = oModel.getProperty("/value") || [];

        const oInvoice = aInvoices.find(function (o) {
            return o?.MetaData?.Object?.Data?.Basics?.Number?.Value === sInvoiceId;
        });

        if (oInvoice) {
            // ✅ /CurrentInvoice dynamisch anlegen/überschreiben
            oModel.setProperty("/CurrentInvoice", oInvoice);

            // ✅ View an /CurrentInvoice binden
            this.getView().bindElement({
                path: "/CurrentInvoice",
                model: "backend"
            });

            this._preparePdfSourceFromInvoice(oInvoice);

        } else {
                console.warn("Keine Rechnung mit ID", sInvoiceId, "gefunden");
            }
        this._rebuildLists();
    },

    //---------------------------------------------------------------------------------------------------PDF anzeigen----------------------------------------------------------------
        _preparePdfSourceFromInvoice: function (oInvoice) {
        return Details_PDFViewHelper.preparePdfSourceFromInvoice(this, oInvoice);
        },

        onPdfPress: function () {
        return Details_PDFViewHelper.onPdfPress(this);
        },
        onFilePress: function () {
        return Details_PDFViewHelper.onFilePress(this);
        },


        onBlobPageChanged: function (oEvent) {
        return Details_PDFViewHelper.onBlobPageChanged(this, oEvent);
        },

        onClose: function () {
        return Details_PDFViewHelper.onClose(this);
        },

    //---------------------------------------------------------------------------------------------------Uploader----------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// UploadSet (Invoice) - sofort speichern bei Drop/Select
// ---------------------------------------------------------------------------------------------------
onInvoiceItemAdded: async function (oEvent) {
    const oItem = oEvent.getParameter("item"); // sap.m.upload.UploadSetItem
    if (!oItem) { return; }

    try {
        await this._persistUploadSetItems([oItem], "ccBT_Invoice", "uploadSetInvoice");
    } catch (e) {
        console.error("Invoice afterItemAdded Fehler:", e);
    }
},

// ---------------------------------------------------------------------------------------------------
// UploadSet (Attachments) - sofort speichern bei Drop/Select
// ---------------------------------------------------------------------------------------------------
onAttachmentItemAdded: async function (oEvent) {
    const oItem = oEvent.getParameter("item");
    if (!oItem) { return; }

    try {
        await this._persistUploadSetItems([oItem], "ccBT_Attachment", "uploadSetAttachments");
    } catch (e) {
        console.error("Attachment afterItemAdded Fehler:", e);
    }
}, 
    _postAppendBlobs: async function (aBlobPayload) {
    const sDocId = this._getCurrentDocumentId();
    if (!sDocId) throw new Error("Keine CurrentInvoice/Id gefunden.");

    const oAuth = this.getOwnerComponent().getModel("auth");
    const sType = oAuth?.getProperty("/tokenType");
    const sTok  = oAuth?.getProperty("/token");

    if (!sType || !sTok) {
        throw new Error("Kein Token im auth-Model gefunden (Login/Token speichern prüfen).");
    }

    const sUrl =
        `https://test.app.clarc.com:443/application/api/v1/documenthub/document(${encodeURIComponent(sDocId)})/appendblobs`;

    const r = await fetch(sUrl, {
        method: "POST",
        credentials: "include",              // wichtig, wie bei dir
        headers: {
        "Content-Type": "application/json",
        "Authorization": `${sType} ${sTok}` // z.B. "Bearer <token>"
        },
        body: JSON.stringify({ Blobs: aBlobPayload })
    });

    if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`appendblobs failed (${r.status}): ${t}`);
    }

    return await r.json();
    },

    // ---------------------------------------------------------------------------------------------------
    // Delete über UploadSet (nachdem User "Remove" bestätigt hat)
    // -> bei bereits persistierten Dateien: Backend removeblobs
    // -> bei noch nicht persistierten (pending): nur aus UI entfernen
    // ---------------------------------------------------------------------------------------------------
    onAfterInvoiceItemRemoved: async function (oEvent) {
        await this._handleUploadSetItemRemoved(oEvent, "uploadSetInvoice");
    },

    onAfterAttachmentItemRemoved: async function (oEvent) {
        await this._handleUploadSetItemRemoved(oEvent, "uploadSetAttachments");
    },

    _handleUploadSetItemRemoved: async function (oEvent, sUploadSetId) {
        const oUS = this.byId(sUploadSetId);
        const oItem = oEvent.getParameter("item");
        if (!oItem) { return; }

        // Fall 1: Item kommt aus Backend-Binding (persistiert)
        const oCtx = oItem.getBindingContext && oItem.getBindingContext("backend");
        const oBlob = oCtx && oCtx.getObject ? oCtx.getObject() : null;
        const sBlobId = oBlob?.Id;

        // Fall 2: Pending item (noch nicht persistiert) -> nichts ins Backend senden
        if (!sBlobId) {
            // falls UI5 es nicht selbst aus incompleteItems entfernt hat:
            try {
                if (oUS && oUS.removeIncompleteItem) {
                    oUS.removeIncompleteItem(oItem);
                }
            } catch (e) { /* ignore */ }
            return;
        }

        try {
            this.getView().setBusy(true);

            const oResp = await this._postRemoveBlobs([sBlobId]);

            const oBackendModel = this.getOwnerComponent().getModel("backend");
            if (oResp?.value) {
                oBackendModel.setProperty("/CurrentInvoice/MetaData/Blobs", oResp.value);
            } else {
                const a = oBackendModel.getProperty("/CurrentInvoice/MetaData/Blobs") || [];
                oBackendModel.setProperty("/CurrentInvoice/MetaData/Blobs", a.filter(b => b?.Id !== sBlobId));
            }

            this._rebuildLists();
        } catch (e) {
            console.error("UploadSet Remove Fehler:", e);
        } finally {
            this.getView().setBusy(false);
        }
    },

    _rebuildLists: function () {
        const oModel = this.getOwnerComponent().getModel("backend");
        const aBlobs = oModel.getProperty("/CurrentInvoice/MetaData/Blobs") || [];
        oModel.setProperty("/CurrentInvoice/InvoiceBlobs", aBlobs.filter(b => b?.Type === "ccBT_Invoice"));
        oModel.setProperty("/CurrentInvoice/AttachmentBlobs", aBlobs.filter(b => b?.Type !== "ccBT_Invoice"));
    },

    _getCurrentDocumentId: function () {
        const oModel = this.getOwnerComponent().getModel("backend");
        return oModel.getProperty("/CurrentInvoice/Id") || "";
    },

    _fileToBase64: function (oFile) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => {
                const s = String(r.result || "");
                const base64 = s.includes("base64,") ? s.split("base64,")[1] : s;
                resolve(base64);
            };
            r.onerror = reject;
            r.readAsDataURL(oFile);
        });
    },

    onBrowseInvoice: function () {
        var oUploader = this.byId("invoiceUploader");
        if (!oUploader) {
            console.error("invoiceUploader nicht gefunden");
            return;
        }

        // Versuche zuerst die UI5-API
        if (oUploader.openFileDialog) {
            oUploader.openFileDialog();
        } else {
            // Fallback: direkt das native <input type="file"> klicken
            setTimeout(function () {
                var oDomRef = oUploader.getDomRef();
                if (!oDomRef) { return; }

                var oFileInput = oDomRef.querySelector("input[type='file']");
                if (oFileInput) {
                    oFileInput.click();
                }
            }, 0);
        }
    },

// ---------------------------------------------------------------------------------------------------
// Gemeinsame Persistenz für UploadSet-Items (Base64 -> appendblobs)
// - nutzt DEINE bestehende Backend-Logik
// - wichtig: danach pending/incomplete Items entfernen, damit keine Duplikate in der Liste bleiben
// ---------------------------------------------------------------------------------------------------
_persistUploadSetItems: async function (aItems, sBlobType, sUploadSetId) {
    if (!Array.isArray(aItems) || !aItems.length) { return; }

    const oUS = this.byId(sUploadSetId);
    const oBackendModel = this.getOwnerComponent().getModel("backend");

    try {
        this.getView().setBusy(true);

        const aPayload = [];

        for (const oItem of aItems) {
            // Nur überspringen, wenn es wirklich ein persistierter Blob aus dem Backend ist
            const oCtx = oItem.getBindingContext && oItem.getBindingContext("backend");
            const oObj = oCtx && oCtx.getObject ? oCtx.getObject() : null;

            // "Blob-Check": hat Id UND FileName (oder MimeType) => dann ist es ein Backend-Blob
            const bIsBackendBlob = !!(oObj && oObj.Id && (oObj.FileName || oObj.MimeType));

            if (bIsBackendBlob) {
                continue; // schon persistiert -> nichts mehr tun
            }

            // File holen (bei neu hinzugefügten Items vorhanden)
            const oFile =
                (oItem.getFileObject && oItem.getFileObject()) ||
                oItem._oFileObject; // fallback, je nach UI5-Version

            if (!oFile) {
                // Wenn kein FileObject da ist, kann man nichts Base64-en
                continue;
            }

            const sB64 = await this._fileToBase64(oFile);

            aPayload.push({
                FileName: oFile.name,
                MimeType: oFile.type || "application/octet-stream",
                Name: oFile.name,
                SortId: 0,
                Type: sBlobType,
                Upload: {
                    GenerateViewBlob: "ccVG_Instant",
                    BlobId: "",
                    BlobData: sB64
                }
            });
        }

        if (!aPayload.length) { return; }

        const oResp = await this._postAppendBlobs(aPayload);

        if (oResp?.value) {
            const aOld = oBackendModel.getProperty("/CurrentInvoice/MetaData/Blobs") || [];
            const aNew = this._mergeBlobsKeepOrder(aOld, oResp.value);

            oBackendModel.setProperty("/CurrentInvoice/MetaData/Blobs", aNew);
            this._rebuildLists();
        }

        // Pending Items aus UploadSet entfernen, sonst bleiben sie zusätzlich zur gebundenen Liste stehen
        if (oUS && oUS.removeIncompleteItem) {
            for (const oItem of aItems) {
                try { oUS.removeIncompleteItem(oItem); } catch (e) { /* ignore */ }
            }
        }

    } finally {
        this.getView().setBusy(false);
    }
},

    _postRemoveBlobs: async function (aBlobIds) {
    const sDocId = this._getCurrentDocumentId();
    if (!sDocId) throw new Error("Keine CurrentInvoice/Id gefunden.");

    const oAuth = this.getOwnerComponent().getModel("auth");
    const sType = oAuth?.getProperty("/tokenType");
    const sTok  = oAuth?.getProperty("/token");
    if (!sType || !sTok) throw new Error("Kein Token im auth-Model gefunden.");

    const sUrl =
        `https://test.app.clarc.com:443/application/api/v1/documenthub/document(${encodeURIComponent(sDocId)})/removeblobs`;

    const r = await fetch(sUrl, {
        method: "POST",
        credentials: "include",
        headers: {
        "Content-Type": "application/json",
        "Authorization": `${sType} ${sTok}`
        },
        body: JSON.stringify({
        Blobs: aBlobIds // 
        })
    });

    if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`removeblobs failed (${r.status}): ${t}`);
    }
    return await r.json();
    },

    _mergeBlobsKeepOrder: function (aOld, aFromResp) {
        const oldArr  = Array.isArray(aOld) ? aOld : [];
        const respArr = Array.isArray(aFromResp) ? aFromResp : [];

        // Map für schnelles Lookup (nach Id)
        const mResp = new Map(respArr.map(b => [b?.Id, b]));

        // 1) alte Reihenfolge behalten, aber Objekte mit Resp "auffrischen"
        const aMerged = [];
        const seen = new Set();

        for (const bOld of oldArr) {
            const id = bOld?.Id;
            if (!id) continue;

            aMerged.push(mResp.get(id) || bOld);
            seen.add(id);
        }

        // 2) neue aus Resp hinten anhängen
        for (const bNew of respArr) {
            const id = bNew?.Id;
            if (!id) continue;
            if (!seen.has(id)) {
                aMerged.push(bNew);
                seen.add(id);
            }
        }

        return aMerged;
    },


    });
});