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

        //Baut Panel komplett neu wenn User eine Rechung selektiert
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

            if (oInvoice) {
                // ✅ /CurrentInvoice dynamisch anlegen/überschreiben
                oModel.setProperty("/CurrentInvoice", oInvoice);

                // ✅ View an /CurrentInvoice binden
                this.getView().bindElement({
                    path: "/CurrentInvoice",
                    model: "backend"
                });

                this._refreshPanel();
                this._rebuildLists();
            } else {
                console.warn("Keine Rechnung mit ID", sInvoiceId, "gefunden");
                console.log("Wanted:", sWanted);
                console.log("Sample Number.Values:", (aInvoices || []).slice(0, 5).map(x =>
                x?.MetaData?.Object?.Data?.Basics?.Number?.Value
                ));
                onsole.log("Sample Ids:", (aInvoices || []).slice(0, 5).map(x => x?.Id));
            }
        },

        //Baut Panel komplett neu wenn User Refresh Button mit dem offenen Panel drückt
        refreshFromInvoiceId: function (sInvoiceId) {
            const oModel = this.getOwnerComponent().getModel("backend");
            if (!oModel) { return; }

            const aInvoices = oModel.getProperty("/value") || [];
            const sWanted = String(sInvoiceId || "").trim();

            let oInvoice = aInvoices.find(o =>
                String(o?.MetaData?.Object?.Data?.Basics?.Number?.Value ?? "").trim() === sWanted
            );

            if (!oInvoice) {
                // Fallback: falls route mal DocId wäre
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

            this._refreshPanel();
            this._rebuildLists();
        },


        //  Refrescht die Reiter im Panel zur Laufzeit. 13.01.2026 Overview: Preview der Bilder; History: das ganze History
        _refreshPanel: function () {
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
        return Details_HistoryHelper.onIconTabSelect(this, oEvent);
        },

        _loadHistoryLogs: function () {
        return Details_HistoryHelper.loadHistoryLogs(this);
        },

        _mapHistoryStatus: function (sDocState, sLogType, sCode, sMsg) {
        return Details_HistoryHelper.mapHistoryStatus(sDocState, sLogType, sCode, sMsg);
        },

        formatHistoryMeta: function (dDate, sCode) {
        return Details_HistoryHelper.formatHistoryMeta(dDate, sCode);
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
    });
});