sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], (Controller, UIComponent, JSONModel ) => {
    "use strict";

    return Controller.extend("billing.controller.View1", {
        onInit() {
        var oModel = new JSONModel();
        this.getView().setModel(oModel, "billings");
        },
        onCreate() {},          
        onSearchLive() {},      
        onFilter() {},          
        onSettings() {},
        onInvoicePress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oCtx = oItem.getBindingContext();

            // Beispiel: wir verwenden die Rechnungsnummer als Schlüssel
            const sInvoiceId = oCtx.getProperty("InvoiceNo"); //später hier auf Rechnungsnummer aus Backend ersetzen. 

            // Layout auf 2 Spalten stellen
            const oMainViewModel = this.getView().getModel("mainView");
            oMainViewModel.setProperty("/layout", "TwoColumnsMidExpanded");

            // Router holen und zur Details-Route navigieren
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("DetailsRoute", {
                invoiceId: sInvoiceId
      });
    }         
    });
});