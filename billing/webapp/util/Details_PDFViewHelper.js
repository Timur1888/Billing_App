sap.ui.define([
  "sap/ui/core/UIComponent"
], function (UIComponent) {
  "use strict";

  return {
    // ==========================================================
    // PDF: Source vorbereiten (URL oder Base64 -> ObjectURL)
    // ==========================================================
    preparePdfSourceFromInvoice: function (oController, oInvoice) {
        const oModel = oController.getOwnerComponent().getModel("backend");
        if (!oModel) { return; }

        const aBlobs = oInvoice?.MetaData?.Blobs || [];

        const isPdf = (b) =>
          b?.MimeType === "application/pdf" || ((b?.FileName || "").toLowerCase().endsWith(".pdf"));

        const isImg = (b) => {
          const fn = (b?.FileName || "").toLowerCase();
          return (b?.MimeType || "").startsWith("image/") ||
                fn.endsWith(".png") || fn.endsWith(".jpg") || fn.endsWith(".jpeg");
        };

        // ✅ PDF + Bilder als Items (Reihenfolge wie Backend)
        const aItems = aBlobs
          .filter(b => isPdf(b) || isImg(b))
          .map(b => {
            const bIsPdf = isPdf(b);
            const sFileName = b.FileName || b.Name || (bIsPdf ? "PDF" : "Image");
            const sLink = b.Link || "";

            // PDF: preview aus ViewBlobs, Bild: direkt Link verwenden
            const sPreview = bIsPdf ? (b?.ViewBlobs?.[0]?.Link || "") : sLink;

            return {
              sortId: b.SortId,
              id: b.Id,
              fileName: sFileName,
              mimeType: b.MimeType || "",
              fileLink: sLink,             // ✅ „Original“ zum Öffnen
              previewLink: sPreview,       // ✅ für Carousel-<Image>
              kind: bIsPdf ? "pdf" : "image",
              icon: bIsPdf ? "sap-icon://pdf-attachment" : "sap-icon://attachment-photo",
              openText: bIsPdf ? "Open PDF" : "Open Image"
            };
          });

        oModel.setProperty("/CurrentInvoice/BlobItems", aItems);

        // Selektion beibehalten (wie bei dir)
        const iOldIndex = oModel.getProperty("/CurrentInvoice/SelectedBlobIndex");
        const sOldId = (Number.isInteger(iOldIndex) && aItems[iOldIndex]) ? aItems[iOldIndex].id : null;

        let iNewIndex = 0;
        if (sOldId) {
          const idx = aItems.findIndex(x => x.id === sOldId);
          if (idx >= 0) iNewIndex = idx;
        } else if (Number.isInteger(iOldIndex) && iOldIndex >= 0 && iOldIndex < aItems.length) {
          iNewIndex = iOldIndex;
        }

        oModel.setProperty("/CurrentInvoice/SelectedBlobIndex", iNewIndex);

        const oSel = aItems[iNewIndex] || null;

        // Für onFilePress brauchen wir jetzt generische Felder:
        oModel.setProperty("/CurrentInvoice/SelectedFileKind", oSel?.kind || "");
        oModel.setProperty("/CurrentInvoice/SelectedFileSource", oSel?.fileLink || "");
        oModel.setProperty("/CurrentInvoice/PdfSource", oSel?.kind === "pdf" ? (oSel?.fileLink || "") : "");
    },



    // PDF: Popup öffnen (wie UI5 Sample)
    onPdfPress: function (oController) {
      const oModel = oController.getOwnerComponent().getModel("backend");
      const sSource = oModel.getProperty("/CurrentInvoice/PdfSource");

      if (!sSource) {
        console.warn("Keine PDF-Quelle vorhanden (/CurrentInvoice/PdfSource ist leer).");
        return;
      }

      // Controller besitzt den Viewer (wird in onInit erzeugt)
      oController._oPdfViewer.setSource(sSource);
      oController._oPdfViewer.setTitle("Invoice PDF");
      oController._oPdfViewer.open();
    },

    onFilePress: function (oController) {
      const oModel = oController.getOwnerComponent().getModel("backend");
      const sKind = oModel.getProperty("/CurrentInvoice/SelectedFileKind");
      const sSource = oModel.getProperty("/CurrentInvoice/SelectedFileSource");

      if (!sSource) {
        console.warn("Keine Quelle vorhanden.");
        return;
      }

      if (sKind === "pdf") {
        // wie bisher
        oController._oPdfViewer.setSource(sSource);
        oController._oPdfViewer.setTitle("Invoice PDF");
        oController._oPdfViewer.open();
        return;
      }

      if (sKind === "image") {
        // ✅ Bild-Popup (lazy, einmalig)
        if (!oController._oImageDialog) {
          oController._oImageDialog = new sap.m.Dialog({
            title: "Image",
            stretch: true,
            content: [
              new sap.m.Image({ width: "100%", densityAware: false })
            ],
            beginButton: new sap.m.Button({
              text: "Close",
              press: function () { oController._oImageDialog.close(); }
            })
          });
          oController.getView().addDependent(oController._oImageDialog);
        }

        const oImg = oController._oImageDialog.getContent()[0];
        oImg.setSrc(sSource);

        oController._oImageDialog.open();
        return;
      }

      // Fallback: unbekannt -> nur neues Tab öffnen
      window.open(sSource, "_blank");
    },


    onBlobPageChanged: function (oController, oEvent) {
      const iIndex = oEvent.getParameter("activePages")[0];
      const oModel = oController.getOwnerComponent().getModel("backend");

      const aItems = oModel.getProperty("/CurrentInvoice/BlobItems") || [];
      const oItem = aItems[iIndex];

      oModel.setProperty("/CurrentInvoice/SelectedBlobIndex", iIndex);
      oModel.setProperty("/CurrentInvoice/SelectedFileKind", oItem?.kind || "");
      oModel.setProperty("/CurrentInvoice/SelectedFileSource", oItem?.fileLink || "");

      // Keep backward compatibility (falls noch irgendwo PdfSource genutzt wird)
      oModel.setProperty("/CurrentInvoice/PdfSource", oItem?.kind === "pdf" ? (oItem?.fileLink || "") : "");
    },


    onClose: function (oController) {
      const oRouter = UIComponent.getRouterFor(oController);
      oRouter.navTo("RouteView1");

      const oMainViewModel = oController.getView().getModel("mainView");
      if (oMainViewModel) {
        oMainViewModel.setProperty("/layout", "OneColumn");
      }
    }
  };
});
