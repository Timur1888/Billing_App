sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/PDFViewer",
    "billing/util/Details_PDFViewHelper",
    "billing/util/Details_HistoryHelper",
    "billing/util/Details_FilesUpload"
], (Controller, UIComponent, Fragment, JSONModel, PDFViewer, Details_PDFViewHelper, Details_HistoryHelper, Details_FilesUpload) => {
    "use strict";

    return Controller.extend("billing.controller.Details", {
        onInit() {
            if (!this.getView().getModel("history")) {
                this.getView().setModel(new sap.ui.model.json.JSONModel({
                busy: false,
                logs: [],              //Braucht man für History
                lastDocId: "",
                billingId: "",      // wird beim Senden der Nachricht benutzt benutzt
                historyDocId: ""   // ✅ optional: DocId aus history-call (für Debug)
                }), "history");
            }

            var oSendModel = new sap.ui.model.json.JSONModel({
                transferFormat: "pdf",
                deliveryMethod: "email",
                recipient: "",
                cc: "",
                bcc: ""
            });
            this.getView().setModel(oSendModel, "send");

            // Template-Model für Dialog
            var oTemplateModel = new JSONModel({
                subject: "",
                body: "",
                languages: [
                    { key: "de", name: "German", selected: true },
                    { key: "en", name: "English", selected: false },
                    { key: "fr", name: "French", selected: false },
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

            // immer unten lassen, damit werden die Items für die Bilder klickbar
            this.byId("uploadSetInvoice")?.addEventDelegate({
                onAfterRendering: () => this._wireUploadSetItemPress("uploadSetInvoice")
            });
            this.byId("uploadSetAttachments")?.addEventDelegate({
                onAfterRendering: () => this._wireUploadSetItemPress("uploadSetAttachments")
            });
        },

        // ==========================================================
        // Panel komplett neu wenn User eine Rechnung selektiert
        // ==========================================================
        _onRouteMatched: function (oEvent) {
            const sInvoiceId = oEvent.getParameter("arguments").invoiceId;

            // Layout sicherstellen
            const oMainViewModel = this.getView().getModel("mainView");
            if (oMainViewModel) {
                oMainViewModel.setProperty("/layout", "TwoColumnsBeginExpanded");
            }

            const oModel = this.getOwnerComponent().getModel("backend");
            if (!oModel) {
                console.error("Model 'backend' nicht gefunden");
                return;
            }

            const aInvoices = oModel.getProperty("/value") || [];
            const sWanted = String(sInvoiceId || "").trim();

            let oInvoice = aInvoices.find(function (o) {
                const v = o?.MetaData?.Object?.Data?.Basics?.Number?.Value;
                return String(v ?? "").trim() === sWanted;
            });

            if (!oInvoice) {
                oInvoice = aInvoices.find(function (o) {
                    return String(o?.Id ?? "").trim() === sWanted;
                });
            }

            if (!oInvoice) {
                console.warn("Keine Rechnung mit ID", sInvoiceId, "gefunden");
                return;
            }

            oModel.setProperty("/CurrentInvoice", oInvoice);

            this.getView().bindElement({
                path: "/CurrentInvoice",
                model: "backend"
            });

            // ✅ Overview/Preview aktualisieren
            this._refreshPanel();

            // ✅ HISTORY: Sofort laden beim Öffnen/Wechseln
            this._loadHistoryLogs(true);

            // ✅ UploadSets/Listen neu aufbauen
            this._rebuildLists();
        },

        // ==========================================================
        // Panel neu wenn User Refresh Button mit offenem Panel drückt
        // ==========================================================
        refreshFromInvoiceId: function (sInvoiceId) {
            const oModel = this.getOwnerComponent().getModel("backend");
            if (!oModel) { return; }

            const aInvoices = oModel.getProperty("/value") || [];
            const sWanted = String(sInvoiceId || "").trim();

            let oInvoice = aInvoices.find(o =>
                String(o?.MetaData?.Object?.Data?.Basics?.Number?.Value ?? "").trim() === sWanted
            );

            if (!oInvoice) {
                oInvoice = aInvoices.find(o => String(o?.Id ?? "").trim() === sWanted);
            }

            if (!oInvoice) {
                console.warn("refreshFromInvoiceId: Invoice nicht gefunden:", sInvoiceId);
                return;
            }

            oModel.setProperty("/CurrentInvoice", oInvoice);

            this.getView().bindElement({
                path: "/CurrentInvoice",
                model: "backend"
            });

            // ✅ Overview/Preview aktualisieren
            this._refreshPanel();

            // ✅ HISTORY: auch beim Refresh neu laden (Helper cached nach DocId)
            this._loadHistoryLogs();

            this._rebuildLists();
        },

        // ==========================================================
        // Refresht NUR Overview (Preview/Carousel) zur Laufzeit
        // ==========================================================
        _refreshPanel: function () {
            const oBackend = this.getOwnerComponent().getModel("backend");
            const oInvoice = oBackend?.getProperty("/CurrentInvoice");
            if (!oInvoice) { return; }

            // OVERVIEW: Preview / Carousel aktualisieren
            this._preparePdfSourceFromInvoice(oInvoice);

            const oCarousel = this.byId("blobCarousel");
            if (oCarousel) {
                const oBind = oCarousel.getBinding("pages");
                if (oBind && oBind.refresh) {
                    oBind.refresh(true);
                }
                oCarousel.invalidate();
            }
        },

        // ==========================================================
        // HISTORY: Tab Select -> sicherstellen, dass Logs da sind
        // ==========================================================
        onIconTabSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key");
            if (sKey === "history") {
                // ✅ Beim Klick auf History nochmal sicher laden (cached -> kein Doppelcall)
                this._loadHistoryLogs();
            }
            // Wenn du im Helper noch andere Logik hast (z.B. scroll), kannst du ihn trotzdem callen:
            // return Details_HistoryHelper.onIconTabSelect(this, oEvent);
        },

        _loadHistoryLogs: function (bForce) {
        return Details_HistoryHelper.loadHistoryLogs(this, !!bForce);
        },

        _mapHistoryStatus: function (sDocState, sLogType, sCode, sMsg) {
            return Details_HistoryHelper.mapHistoryStatus(sDocState, sLogType, sCode, sMsg);
        },

        formatHistoryMeta: function (dDate, sCode) {
            return Details_HistoryHelper.formatHistoryMeta(dDate, sCode);
        },

        // ------------------------------- Edit Templates -------------------------------
        onEditTemplate: function () {
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
            if (this._oTemplateDialog) {
                this._oTemplateDialog.close();
            }
        },

        // ------------------------------- PDF anzeigen -------------------------------
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

        // ------------------------------- Uploader -------------------------------
        onInvoiceItemAdded: function (oEvent) {
            return Details_FilesUpload.onInvoiceItemAdded(this, oEvent);
        },

        onAttachmentItemAdded: function (oEvent) {
            return Details_FilesUpload.onAttachmentItemAdded(this, oEvent);
        },

        onAfterInvoiceItemRemoved: function (oEvent) {
            return Details_FilesUpload.onAfterInvoiceItemRemoved(this, oEvent);
        },

        onAfterAttachmentItemRemoved: function (oEvent) {
            return Details_FilesUpload.onAfterAttachmentItemRemoved(this, oEvent);
        },

        _rebuildLists: function () {
            return Details_FilesUpload.rebuildLists(this);
        },

        _getCurrentDocumentId: function () {
            return Details_FilesUpload.getCurrentDocumentId(this);
        },

        onBrowseInvoice: function () {
            return Details_FilesUpload.onBrowseInvoice(this);
        },

        _wireUploadSetItemPress: function (sUploadSetId) {
            return Details_FilesUpload.wireUploadSetItemPress(this, sUploadSetId);
        },
//---------------------------------------------------------------------------------------------Senden------------------------------------------------------------------------------------------------------
        onSendInvoice: async function () {
            const oView    = this.getView();
            const oSend    = oView.getModel("send");
            const oAuth    = this.getOwnerComponent().getModel("auth");
            const oHistory = oView.getModel("history");
            const oModel   = this.getOwnerComponent().getModel("backend");

            // ---------------------------
            // Helper: String → [{Address}]
            // ---------------------------
            const fnToAddressArray = (s) =>
            (s || "")
                .split(",")
                .map(x => x.trim())
                .filter(Boolean)
                .map(addr => ({
                Address: addr,
                Email: addr,   // ✅ fallback
                Value: addr    // ✅ fallback
                }));

            // 1) Werte aus UI
            const sRecipient = (oSend?.getProperty("/recipient") || "").trim();
            const sCc        = (oSend?.getProperty("/cc") || "").trim();
            const sBcc       = (oSend?.getProperty("/bcc") || "").trim();

            if (!sRecipient) {
                sap.m.MessageBox.warning("Please enter a Receiver email.");
                return;
            }

            const sDocHubItemId = (oModel?.getProperty("/CurrentInvoice/Id") || "").trim();
            if (!sDocHubItemId) {
                sap.m.MessageBox.error("No document selected (DocHubItemId is empty).");
                return;
            }

            // BillingId aus history-Model
            let sBillingId = (oHistory?.getProperty("/billingId") || "").trim();
            if (!sBillingId && typeof this._loadHistoryLogs === "function") {
                await this._loadHistoryLogs(true);
                sBillingId = (oHistory?.getProperty("/billingId") || "").trim();
            }

            if (!sBillingId) {
                sap.m.MessageBox.error("Billing Id not found.");
                return;
            }

            // Token
            const sType = (oAuth?.getProperty("/tokenType") || "Bearer").trim();
            const sTok  = (oAuth?.getProperty("/token") || "").trim();
            if (!sTok) {
                sap.m.MessageBox.error("No auth token found.");
                return;
            }

            // ---------------------------
            // Payload (NEUE STRUKTUR)
            // ---------------------------
            const oPayload = {
                DocHubItemId: sDocHubItemId,
                Recipient: fnToAddressArray(sRecipient),
                Cc: fnToAddressArray(sCc),
                Bcc: fnToAddressArray(sBcc),
                Subject: "Testbetreff TKA",
                Body: "Test TKA"
            };

            if (!oPayload.Recipient.length) {
                sap.m.MessageBox.error("At least one recipient is required.");
                return;
            }

            const sUrl =
                `https://test.app.clarc.com:443/application/api/v1/bpm/billing(${encodeURIComponent(sBillingId)})/sendinvoice`;

            try {
                oView.setBusy(true);

                const oResp = await fetch(sUrl, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `${sType} ${sTok}`
                },
                body: JSON.stringify(oPayload)
                });

                const sText = await oResp.text();
                if (!oResp.ok) {
                sap.m.MessageBox.error(`Send failed (${oResp.status}): ${sText}`);
                return;
                }

                sap.m.MessageToast.show("Invoice sent successfully.");
            } catch (e) {
                sap.m.MessageBox.error(`Send failed: ${e?.message || e}`);
            } finally {
                oView.setBusy(false);
            }
        },
    });
});
