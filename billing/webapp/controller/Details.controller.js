sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/unified/FileUploader",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/PDFViewer",
    "sap/m/PDFViewerDisplayType"
], (Controller, UIComponent, FileUploader, Fragment, JSONModel, PDFViewer, PDFViewerDisplayType) => {
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
            
            // ✅ PDFViewer Instanz (lazy) + gemerkte ObjectURL
            this._oPdfViewer = null;
            this._sCurrentObjectUrl = null;

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

        // ==========================================================
        // PDF: Source vorbereiten (URL oder Base64 -> ObjectURL)
        // ==========================================================
        _preparePdfSourceFromInvoice: function (oInvoice) {
            const oModel = this.getOwnerComponent().getModel("backend");
            if (!oModel) { return; }

            const aBlobs = oInvoice?.MetaData?.Blobs || [];

            // Priorität: ccBT_Invoice + application/pdf, sonst erstes PDF, sonst *.pdf
            const oPdfBlob =
                aBlobs.find(b => b?.MimeType === "application/pdf" && b?.Type === "ccBT_Invoice")
                || aBlobs.find(b => b?.MimeType === "application/pdf")
                || aBlobs.find(b => (b?.FileName || "").toLowerCase().endsWith(".pdf"));

            const sLink = oPdfBlob?.Link || "";

            // falls du später ObjectURL nutzt, würdest du hier vorher revoke machen
            oModel.setProperty("/CurrentInvoice/PdfSource", sLink);
        },



        // PDF: Popup öffnen (wie UI5 Sample)
        onPdfPress: function () {
            const oModel = this.getOwnerComponent().getModel("backend");
            const sSource = oModel.getProperty("/CurrentInvoice/PdfSource");

            if (!sSource) {
                console.warn("Keine PDF-Quelle vorhanden (/CurrentInvoice/PdfSource ist leer).");
                return;
            }

            // Dialog + PDFViewer lazy erzeugen (Popup wie Sample, aber zuverlässig)
            if (!this._oPdfDialog) {
                this._oPdfDialog = new sap.m.Dialog({
                    title: "Invoice PDF",
                    contentWidth: "80vw",
                    contentHeight: "80vh",
                    resizable: true,
                    draggable: true,
                    horizontalScrolling: false,
                    verticalScrolling: false,
                    endButton: new sap.m.Button({
                        text: "Close",
                        press: () => this._oPdfDialog.close()
                    })
                });

                this._oPdfViewer = new (sap.m.PDFViewer)({
                    width: "100%",
                    height: "100%",
                    isTrustedSource: true,
                    showDownloadButton: true
                });

                this._oPdfDialog.addContent(this._oPdfViewer);
                this.getView().addDependent(this._oPdfDialog);
            }

            this._oPdfViewer.setSource(sSource);
            this._oPdfDialog.open();
        },

        onAfterRendering: function () {
            const oDom = document.getElementById("pdfOverlay");
            if (oDom && !this._pdfOverlayBound) {
                this._pdfOverlayBound = true;
                oDom.addEventListener("click", () => this.onPdfPress());
            }
        },
        onExit: function () {
            // Nur nötig, wenn du ObjectURLs erzeugst (Base64 -> Blob -> URL.createObjectURL)
            if (this._sCurrentObjectUrl) {
                try { URL.revokeObjectURL(this._sCurrentObjectUrl); } catch (e) {}
                this._sCurrentObjectUrl = null;
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