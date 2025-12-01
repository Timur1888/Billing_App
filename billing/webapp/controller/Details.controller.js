sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent"
], (Controller, UIComponent) => {
    "use strict";

    return Controller.extend("billing.controller.Details", {
        onInit() {
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("DetailsRoute").attachPatternMatched(this._onRouteMatched, this);
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
    }
    });
});