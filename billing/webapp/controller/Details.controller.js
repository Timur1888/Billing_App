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
        oMainViewModel.setProperty("/layout", "TwoColumnsMidExpanded");

        // Einfaches Beispiel: wir suchen im bestehenden Modell nach der passenden Rechnung
      const oModel = this.getView().getModel();
      const aInvoices = oModel.getProperty("/Invoices") || [];
      const oInvoice = aInvoices.find(o => o.InvoiceNo === sInvoiceId);

      if (oInvoice) {
        // eigenen Pfad im Modell setzen, damit die View binden kann
        // einfache Variante: wir legen die Daten unter /CurrentInvoice ab
        oModel.setProperty("/CurrentInvoice", oInvoice);
        this.getView().bindElement("/CurrentInvoice");
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