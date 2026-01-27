sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/unified/FileUploader",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
], (Controller, UIComponent, FileUploader, Fragment, JSONModel) => {
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

            const oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("DetailsRoute").attachPatternMatched(this._onRouteMatched, this);
        },
  //---------------------------------------------------------------------------------------------------Edit Templates----------------------------------------------------------------
        onEditTemplate: function () {
            // Dialog lazy laden
            if (!this._oTemplateDialog) {
                Fragment.load({
                    name: "billing.view.fragments.MessageTemplateDialog",
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

          // Layout sicherstellen
          const oMainViewModel = this.getView().getModel("mainView");
          oMainViewModel.setProperty("/layout", "TwoColumnsBeginExpanded");

          // 👉 Model "testData" holen
          const oModel = this.getView().getModel("testData");

          // Liste liegt unter "/value"
          const aInvoices = oModel.getProperty("/value") || [];

          // passendes Objekt anhand der Rechnungsnummer suchen
          const oInvoice = aInvoices.find(function (o) {
              return o?.MetaData?.Object?.Data?.Basics?.Number?.Value === sInvoiceId;
              // falls du trimmed hast, hier auch ggf. trim()
          });

          if (oInvoice) {
              // Daten im Model unter /CurrentInvoice ablegen
              oModel.setProperty("/CurrentInvoice", oInvoice);

              // View an diesen Knoten des Models "testData" binden
              this.getView().bindElement({
                  path: "/CurrentInvoice",
                  model: "testData"
              });
          } else {
              console.warn("Keine Rechnung mit ID", sInvoiceId, "gefunden");
          }
      },
    onClose: function () {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteView1");

      const oMainViewModel = this.getView().getModel("mainView");
      oMainViewModel.setProperty("/layout", "OneColumn");
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