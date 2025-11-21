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
                        icon: "sap-icon://add",
                        press: this.onAddFilterPress.bind(this)
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

    onAddFilterPress: function () {
        this._oFilterPopover.close();

        if (!this._oFilterDialog) {
            this._sFilterFragmentId = "filterDialogFragment";

            this._oFilterDialog = sap.ui.xmlfragment(
                this._sFilterFragmentId,
                "billing.view.FilterDialog",
                this
            );
            this.getView().addDependent(this._oFilterDialog);
        }

        this._resetFilterDialogFields();  // Grundzustand
        this._oFilterDialog.open();
    },



    onFilterFieldChange: function (oEvent) {
        var sKey    = oEvent.getSource().getSelectedKey();
        var oBoxPH  = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "boxValuePlaceholder");
        var oBoxDate= sap.ui.core.Fragment.byId(this._sFilterFragmentId, "boxDateRange");
        var oBoxInv = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "boxInvoiceNo");

        // Platzhalter ausblenden
        oBoxPH.setVisible(false);

        if (sKey === "CREATION_DATE") {
            oBoxDate.setVisible(true);
            oBoxInv.setVisible(false);
        } else if (sKey === "INVOICE_NO") {
            oBoxDate.setVisible(false);
            oBoxInv.setVisible(true);
        } else {
            // falls nichts gewählt wurde (zur Sicherheit)
            oBoxPH.setVisible(true);
            oBoxDate.setVisible(false);
            oBoxInv.setVisible(false);
        }
    },


    onFilterDialogCancel: function () {
        this._resetFilterDialogFields();
        this._oFilterDialog.close();
    },

    onFilterDialogSave: function () {
        // hier später Filterwerte auslesen & Tabelle filtern
        // jetzt NUR UI: Dialog schließen
        if (this._oFilterDialog) {
            this._oFilterDialog.close();
        }
    },

_resetFilterDialogFields: function () {
    if (!this._oFilterDialog) {
        return;
    }

    var oSelect   = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "selFilterField");
    var oBoxPH    = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "boxValuePlaceholder");
    var oBoxDate  = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "boxDateRange");
    var oBoxInv   = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "boxInvoiceNo");
    var oDrs      = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "drsCreationDate");
    var oInpInv   = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "inpInvoiceNo");

    // links: keine Auswahl
    oSelect.setSelectedKey("");

    // Werte löschen
    if (oDrs) {
        oDrs.setValue(""); // setzt DateRangeSelection zurück
    }
    if (oInpInv) {
        oInpInv.setValue("");
    }

    // rechts: nur Platzhalter anzeigen
    oBoxPH.setVisible(true);
    oBoxDate.setVisible(false);
    oBoxInv.setVisible(false);
},


    onFilter: function (oEvent) {
        const oButton = oEvent.getSource();
        const oPopover = this._createFilterPopover();
        oPopover.openBy(oButton);
    }
            
    });
});