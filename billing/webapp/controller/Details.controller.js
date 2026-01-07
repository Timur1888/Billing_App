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

    onInvoiceChange: function (oEvent) {
        var aFiles = oEvent.getParameter("files") || [];
        var oModel = this.getView().getModel("upload");

        if (aFiles.length > 0) {
            oModel.setProperty("/invoiceFiles", [{
                name: aFiles[0].name,
                file: aFiles[0]
            }]);
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

    onAttachmentsChange: function (oEvent) {
        var aFiles = oEvent.getParameter("files") || [];
        var oModel = this.getView().getModel("upload");
        var aCurrent = oModel.getProperty("/attachments") || [];

        aFiles.forEach(function (oFile) {
            aCurrent.push({
                name: oFile.name,
                file: oFile
            });
        });

        oModel.setProperty("/attachments", aCurrent);
    }

        });
});