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

            if (!this.getView().getModel("history")) {
                this.getView().setModel(new sap.ui.model.json.JSONModel({
                busy: false,
                logs: []
                }), "history");
            }

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

            //immer unten lassen, damit werden die Items für die Bilder klickbar
            this.byId("uploadSetInvoice")?.addEventDelegate({
            onAfterRendering: () => this._wireUploadSetItemPress("uploadSetInvoice")
            });
            this.byId("uploadSetAttachments")?.addEventDelegate({
            onAfterRendering: () => this._wireUploadSetItemPress("uploadSetAttachments")
            });
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

                this._refreshPreviewPanel();

            } else {
                    console.warn("Keine Rechnung mit ID", sInvoiceId, "gefunden");
                }
            this._rebuildLists();
        },

        //  Refrescht den Panel den Änderungen zur Laufzeit
        _refreshPreviewPanel: function () {
            const oView = this.getView();
            const oBackend = this.getOwnerComponent().getModel("backend");
            const oHistory = oView.getModel("history");

            const oInvoice = oBackend.getProperty("/CurrentInvoice");
            if (!oInvoice || !oHistory) {
                return;
            }

            // =====================================================
            // OVERVIEW: Preview / Carousel aktualisieren
            // =====================================================
            this._preparePdfSourceFromInvoice(oInvoice);

            const oCarousel = this.byId("blobCarousel");
            if (oCarousel) {
                const oBind = oCarousel.getBinding("pages");
                if (oBind && oBind.refresh) {
                    oBind.refresh(true);
                }
                oCarousel.invalidate();
            }

            // =====================================================
            // HISTORY: Live-Refresh bei Rechnungswechsel
            // =====================================================
            const sDocId = this._getCurrentDocumentId();
            const sLastDocId = oHistory.getProperty("/lastDocId");
            const sActiveTab = this.byId("itbDetails")?.getSelectedKey?.();

            // Wenn keine DocId → History leeren
            if (!sDocId) {
                oHistory.setProperty("/logs", []);
                oHistory.setProperty("/lastDocId", "");
                return;
            }

            // Wenn Rechnung gewechselt hat
            if (sDocId !== sLastDocId) {

                // Alte Logs sofort entfernen (kein "Ghost History")
                oHistory.setProperty("/logs", []);
                oHistory.setProperty("/lastDocId", sDocId);

                // Nur laden, wenn History sichtbar ist
                if (sActiveTab === "history") {
                    this._loadHistoryLogs();
                }
            }
        },


 //-----------------------------------------------------------------------------------------------------History-Reiter laden-----------------------------------------------------------       
        onIconTabSelect: function (oEvent) {
            if (oEvent.getParameter("key") !== "history") {
                return;
            }

            const oHistory = this.getView().getModel("history");
            const sDocId = this._getCurrentDocumentId();

            if (!oHistory || !sDocId) {
                return;
            }

            const aLogs = oHistory.getProperty("/logs") || [];
            const sLastDocId = oHistory.getProperty("/lastDocId");

            // Wenn Logs fehlen oder DocId gewechselt hat → laden
            if (!aLogs.length || sLastDocId !== sDocId) {
                oHistory.setProperty("/lastDocId", sDocId);
                this._loadHistoryLogs();
            }
        },

    _loadHistoryLogs: async function () {
  const oHistory = this.getView().getModel("history");
  const oAuth = this.getOwnerComponent().getModel("auth");

  const sType = oAuth?.getProperty("/tokenType");
  const sTok  = oAuth?.getProperty("/token");
  const sDocId = this._getCurrentDocumentId();

  if (!sDocId) {
    oHistory.setProperty("/logs", []);
    return;
  }

  if (!sTok) {
    oHistory.setProperty("/logs", [{
      message: "No auth token available.",
      date: new Date(),
      code: "",
      statusText: "Information",
      statusState: "Information"
    }]);
    return;
  }

  oHistory.setProperty("/busy", true);

  try {
    // API laut Beschreibung: .../documenthub/document(DocumentId)
    // Wir versuchen zuerst exakt diese Form, und fallback auf /document/<id>
    const sBase = "https://test.app.clarc.com:443/application/api/v1/documenthub";
    const sUrl1 = `${sBase}/document(${encodeURIComponent(sDocId)})`;
    const sUrl2 = `${sBase}/document/${encodeURIComponent(sDocId)}`;

    const oHeaders = {
      "Authorization": `${sType} ${sTok}`,
      "Accept": "application/json"
    };

    let oData;
    try {
      const r1 = await fetch(sUrl1, { method: "GET", headers: oHeaders });
      if (!r1.ok) throw new Error(`HTTP ${r1.status} ${r1.statusText}`);
      oData = await r1.json();
    } catch (e1) {
      const r2 = await fetch(sUrl2, { method: "GET", headers: oHeaders });
      if (!r2.ok) throw new Error(`HTTP ${r2.status} ${r2.statusText}`);
      oData = await r2.json();
    }

    const aChangeLog = Array.isArray(oData?.ChangeLog) ? oData.ChangeLog : [];
    const sDocState = oData?.State || "";

    // Mapping: ChangeLog[] -> List Items
    const aLogs = aChangeLog
      .map((x) => {
        const oDateRaw = x?.Date;
        const nMs = oDateRaw?.$date ?? oDateRaw; // unterstützt {$date: ...} oder direkt ms
        const d = nMs ? new Date(nMs) : new Date();

        const sMsg = x?.Text || "";
        const sCode = x?.Code || "";
        const sTypeLog = x?.Type || "";

        const oStatus = this._mapHistoryStatus(sDocState, sTypeLog, sCode, sMsg);

        return {
          message: this._buildHistoryMessage(x),
          date: d,
          code: sCode,
          statusText: oStatus.text,
          statusState: oStatus.state
        };
      })
      // neueste zuerst (wie im Screenshot)
      .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

    oHistory.setProperty("/logs", aLogs);

  } catch (err) {
    oHistory.setProperty("/logs", [{
      message: `Failed to load history: ${err.message || err}`,
      date: new Date(),
      code: "",
      statusText: "Warning",
      statusState: "Warning"
    }]);
  } finally {
    oHistory.setProperty("/busy", false);
  }
},

_buildHistoryMessage: function (x) {
  // Beispiel wie im Screenshot: "processing exception [...]"
  // Wenn du es lieber kurz willst: nur x.Text zurückgeben.
  const sText = x?.Text || "";
  const sType = x?.Type || "";
  const sUser = x?.User || "";

  // Beispiel-Output:
  // "document created" (ccMT_Insert, test)
  // oder wenn Text schon ausführlich ist: nur Text.
  if (sText && sText.length > 0) {
    return sText;
  }
  return [sType, sUser].filter(Boolean).join(" - ");
},

_mapHistoryStatus: function (sDocState, sLogType /* ccMT_* */, sCode, sMsg) {
  switch (sLogType) {
    case "ccMT_Success":
      return { text: "Success", state: "Success" };

    case "ccMT_Info":
      return { text: "Information", state: "Information" };

    case "ccMT_Warning":
      return { text: "Warning", state: "Warning" };

    case "ccMT_Error":
      return { text: "Error", state: "Error" };

    case "ccMT_Update":
      // Update ist fachlich meist kein Fehler -> Info (oder Success, wenn ihr das so wollt)
      return { text: "Information", state: "Information" };

    default:
      return { text: "Information", state: "Information" };
  }
},

formatHistoryMeta: function (dDate, sCode) {
  if (!dDate) return sCode || "";

  const oFmt = sap.ui.core.format.DateFormat.getDateTimeInstance({
    pattern: "dd.MM.yy HH:mm:ss"
  });

  const sD = oFmt.format(dDate instanceof Date ? dDate : new Date(dDate));
  const sC = (sCode || "").trim();

  return sC ? `${sD} | ${sC}` : sD;
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
        this._refreshPanel();
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

    this._wireUploadSetItemPress("uploadSetInvoice");
    this._wireUploadSetItemPress("uploadSetAttachments");
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

    _wireUploadSetItemPress: function (sUploadSetId) {
  const oUS = this.byId(sUploadSetId);
  if (!oUS) { return; }

  oUS.getItems().forEach((oUSItem) => {
    const oListItem = oUSItem.getListItem && oUSItem.getListItem();
    if (!oListItem) { return; }

    // nur einmal verdrahten
    if (oListItem.data("__wiredPress")) { return; }
    oListItem.data("__wiredPress", true);

    // Klickbar machen
    if (oListItem.setType) {
      oListItem.setType("Active");
    }

    // press handler
    oListItem.attachPress(() => {
      this._openUploadSetItem(oUSItem);
    });
  });
},

_openUploadSetItem: function (oUSItem) {
  // Daten aus Backend-Binding holen
  const oCtx = oUSItem.getBindingContext && oUSItem.getBindingContext("backend");
  const oObj = oCtx && oCtx.getObject ? oCtx.getObject() : null;

  // URL: bei dir ist im XML url="{backend>DownloadUrl}"
  const sUrl = oObj?.DownloadUrl || oObj?.Link || oUSItem.getUrl?.() || "";
  const sName = oObj?.FileName || oUSItem.getFileName?.() || "File";
  const sMime = oObj?.MimeType || oUSItem.getMediaType?.() || "";

  if (!sUrl) {
    console.warn("Keine URL zum Öffnen gefunden");
    return;
  }

  const bIsPdf = sMime === "application/pdf" || sName.toLowerCase().endsWith(".pdf");
  const bIsImg = (sMime || "").startsWith("image/") || /\.(png|jpe?g)$/i.test(sName);

  if (bIsPdf) {
    this._oPdfViewer.setSource(sUrl);
    this._oPdfViewer.setTitle(sName);
    this._oPdfViewer.open();
    return;
  }

  if (bIsImg) {
    if (!this._oImageDialog) {
      this._oImageDialog = new sap.m.Dialog({
        title: "Image",
        stretch: true,
        content: [ new sap.m.Image({ width: "100%", densityAware: false }) ],
        beginButton: new sap.m.Button({
          text: "Close",
          press: () => this._oImageDialog.close()
        })
      });
      this.getView().addDependent(this._oImageDialog);
    }

    this._oImageDialog.setTitle(sName);
    this._oImageDialog.getContent()[0].setSrc(sUrl);
    this._oImageDialog.open();
    return;
  }

  window.open(sUrl, "_blank", "noopener");
},
    });
});