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

    //---------------------------------------------------------------------------------------------------PDF abzeigen----------------------------------------------------------------
        _preparePdfSourceFromInvoice: function (oInvoice) {
        return Details_PDFViewHelper.preparePdfSourceFromInvoice(this, oInvoice);
        },

        onPdfPress: function () {
        return Details_PDFViewHelper.onPdfPress(this);
        },

        onBlobPageChanged: function (oEvent) {
        return Details_PDFViewHelper.onBlobPageChanged(this, oEvent);
        },

        onClose: function () {
        return Details_PDFViewHelper.onClose(this);
        },

    //---------------------------------------------------------------------------------------------------Uploader----------------------------------------------------------------
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

    onDeleteBlob: async function (oEvent) {
        const oCtx  = oEvent.getSource().getBindingContext("backend");
        const oBlob = oCtx?.getObject();
        const sBlobId = oBlob?.Id;

        if (!sBlobId) return;

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
            console.error("Delete Blob Fehler:", e);
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

    onInvoiceChange: async function (oEvent) {
        const aFiles = oEvent.getParameter("files") || [];
        if (!aFiles.length) { return; }

        const oFile = aFiles[0];
        const oBackendModel = this.getOwnerComponent().getModel("backend");

        try {
            this.getView().setBusy(true);

            const sB64 = await this._fileToBase64(oFile);

            const aPayload = [{
                FileName: oFile.name,
                MimeType: oFile.type || "application/octet-stream",
                Name: oFile.name,
                SortId: 0,
                Type: "ccBT_Invoice",
                Upload: {
                    GenerateViewBlob: "ccVG_Instant",
                    BlobId: "",
                    BlobData: sB64
                }
            }];

            const oResp = await this._postAppendBlobs(aPayload);

            // ✅ Backend-Model updaten -> Liste aktualisieren
            if (oResp?.value) {
                oBackendModel.setProperty("/CurrentInvoice/MetaData/Blobs", oResp.value);
                this._rebuildLists();
            }

            // optional: FileUploader resetten, damit gleicher File nochmal gewählt werden kann
            const oUploader = this.byId("invoiceUploader");
            if (oUploader) { oUploader.clear(); }

        } catch (e) {
            console.error("Invoice Upload Fehler:", e);
        } finally {
            this.getView().setBusy(false);
        }
    },

    onBrowseAttachments: function () {
        var oUploader = this.byId("attachmentsUploader");
        if (!oUploader) {
            console.error("attachmentsUploader nicht gefunden");
            return;
        }

        if (oUploader.openFileDialog) {
            oUploader.openFileDialog();
        } else {
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

    onAttachmentsChange: async function (oEvent) {
        const aFiles = oEvent.getParameter("files") || [];
        if (!aFiles.length) { return; }

        const oBackendModel = this.getOwnerComponent().getModel("backend");

        try {
            this.getView().setBusy(true);

            const aPayload = [];
            for (const oFile of aFiles) {
                const sB64 = await this._fileToBase64(oFile);

                aPayload.push({
                    FileName: oFile.name,
                    MimeType: oFile.type || "application/octet-stream",
                    Name: oFile.name,
                    SortId: 0,
                    Type: "ccBT_Attachment", // falls euer Backend anderes erwartet -> anpassen
                    Upload: {
                        GenerateViewBlob: "ccVG_Instant",
                        BlobId: "",
                        BlobData: sB64
                    }
                });
            }

            const oResp = await this._postAppendBlobs(aPayload);

            if (oResp?.value) {
                oBackendModel.setProperty("/CurrentInvoice/MetaData/Blobs", oResp.value);
                this._rebuildLists();
            }

            const oUploader = this.byId("attachmentsUploader");
            if (oUploader) { oUploader.clear(); }

        } catch (e) {
            console.error("Attachments Upload Fehler:", e);
        } finally {
            this.getView().setBusy(false);
        }
    },

    onBlobOpen: function (oEvent) {
        const oSrc = oEvent.getParameter("srcControl");
        if (oSrc && oSrc.isA && oSrc.isA("sap.m.Button")) {
            return; // Button-Klick -> kein Open
        }

        const oItem = oEvent.getParameter("listItem");
        const oCtx  = oItem.getBindingContext("backend");
        const oBlob = oCtx.getObject();

        if (!oBlob?.Link) { return; }
        this._openPdfPopup(oBlob.Link, oBlob.FileName || "Document");
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

    _openPdfPopup: function (sUrl, sTitle) {
        // Viewer existiert schon aus onInit()
        this._oPdfViewer.setSource(sUrl);
        this._oPdfViewer.setTitle(sTitle);

        // Popup (wie Sample)
        // (Wenn du DisplayType gesetzt hast: hier NICHT "Popup" als String, sondern Enum)
        this._oPdfViewer.open();
    },

    });
});