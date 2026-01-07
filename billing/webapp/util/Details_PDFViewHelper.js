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

      // Nur PDFs als "Items" für Carousel
      const aPdfItems = aBlobs
        .filter(b => b?.MimeType === "application/pdf" || (b?.FileName || "").toLowerCase().endsWith(".pdf"))
        .map(b => {
          return {
            sortId: b.SortId,
            id: b.Id,
            fileName: b.FileName || b.Name || "PDF",
            pdfLink: b.Link || "",
            previewLink: b?.ViewBlobs?.[0]?.Link || "" // kann leer sein
          };
        })
        .sort((a, c) => (a.sortId ?? 0) - (c.sortId ?? 0));

      oModel.setProperty("/CurrentInvoice/BlobItems", aPdfItems);

      // Default: erstes Item selektieren
      const oFirst = aPdfItems[0] || null;
      oModel.setProperty("/CurrentInvoice/SelectedBlobIndex", 0);
      oModel.setProperty("/CurrentInvoice/PdfSource", oFirst?.pdfLink || "");
      oModel.setProperty("/CurrentInvoice/PdfPreviewUrl", oFirst?.previewLink || "");
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

    onBlobPageChanged: function (oController, oEvent) {
      const iIndex = oEvent.getParameter("activePages")[0]; // Carousel liefert activePages array
      const oModel = oController.getOwnerComponent().getModel("backend");

      const aItems = oModel.getProperty("/CurrentInvoice/BlobItems") || [];
      const oItem = aItems[iIndex];

      oModel.setProperty("/CurrentInvoice/SelectedBlobIndex", iIndex);
      oModel.setProperty("/CurrentInvoice/PdfSource", oItem?.pdfLink || "");
      oModel.setProperty("/CurrentInvoice/PdfPreviewUrl", oItem?.previewLink || "");
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
