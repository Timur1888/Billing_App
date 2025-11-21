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
            oMainViewModel.setProperty("/layout", "TwoColumnsBeginExpanded");

            // Router holen und zur Details-Route navigieren
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("DetailsRoute", {
                invoiceId: sInvoiceId
      });
    },
    _createFilterPopover: function () {
        if (!this._oFilterPopover) {

            // Liste zuerst in eine Variable packen
            var oList = new sap.m.List({
                items: [
                    new sap.m.StandardListItem({
                        title: "Add Filter",
                        type: "Navigation",
                        icon: "sap-icon://add"
                        // press-Handler später
                    })
                ]
            });

            // eigene CSS-Klasse für Fokus-Styling
            oList.addStyleClass("filterPopoverList");

            this._oFilterPopover = new sap.m.Popover({
                placement: sap.m.PlacementType.Bottom,
                showHeader: false,
                contentWidth: "200px",
                content: [oList]
            });

            this.getView().addDependent(this._oFilterPopover);
        }

        return this._oFilterPopover;
    },

    onFilter: function (oEvent) {
        const oButton = oEvent.getSource();
        const oPopover = this._createFilterPopover();
        oPopover.openBy(oButton);
    }
            
    });
});