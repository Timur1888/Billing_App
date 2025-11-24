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

        this._initFilterRows();   // immer mit einer leeren Zeile starten
        this._oFilterDialog.open();
    },

    _initFilterRows: function () {
    const oContainer = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "filtersContainer");
    oContainer.removeAllItems();
    this._addEmptyFilterRow();
    },

    _addEmptyFilterRow: function () {
    const oContainer = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "filtersContainer");

    // äußere Zeile
    const oRow = new sap.m.HBox({
        width: "100%",
        justifyContent: "SpaceBetween",
        class: "sapUiSmallMarginBottom"
    });

    // ===== links: Select Filter =====
    const oLeftBox = new sap.m.VBox({ width: "48%" });
    oLeftBox.addItem(new sap.m.Label({
        text: "Select Filter",
        class: "sapUiTinyMarginBottom"
    }));

    const oSelect = new sap.m.Select({
        width: "100%",
        selectedKey: "",
        forceSelection: false,
        change: this.onFilterFieldChange.bind(this)  // Handler unten
    });

    oSelect.addItem(new sap.ui.core.Item({
        key: "CREATION_DATE",
        text: "Creation Date"
    }));
    oSelect.addItem(new sap.ui.core.Item({
        key: "INVOICE_NO",
        text: "Invoice No."
    }));

    oLeftBox.addItem(oSelect);

    // ===== rechts: Platzhalter + DateRange + Input =====
    const oRightBox = new sap.m.VBox({ width: "48%" });

    // Platzhalter "Filter Type"
    const oPlaceholderBox = new sap.m.VBox();
    oPlaceholderBox.addItem(new sap.m.Label({
        text: "Filter Type",
        class: "sapUiTinyMarginBottom"
    }));
    const oPlaceholderSelect = new sap.m.Select({
        width: "100%",
        enabled: false
    });
    oPlaceholderSelect.addItem(new sap.ui.core.Item({
        key: "",
        text: "Filter Type"
    }));
    oPlaceholderBox.addItem(oPlaceholderSelect);

    // DateRange
    const oDateBox = new sap.m.VBox({ visible: false });
    oDateBox.addItem(new sap.m.Label({
        text: "Date Range",
        class: "sapUiTinyMarginBottom"
    }));
    const oDateRange = new sap.m.DateRangeSelection({
        width: "100%",
        displayFormat: "dd.MM.yyyy",
        delimiter: " - "
    });
    oDateBox.addItem(oDateRange);

    // Invoice No.
    const oInvoiceBox = new sap.m.VBox({ visible: false });
    oInvoiceBox.addItem(new sap.m.Label({
        text: "Invoice No.",
        class: "sapUiTinyMarginBottom"
    }));
    const oInvoiceInput = new sap.m.Input({
        width: "100%",
        placeholder: "Enter invoice number"
    });
    oInvoiceBox.addItem(oInvoiceInput);

    oRightBox.addItem(oPlaceholderBox);
    oRightBox.addItem(oDateBox);
    oRightBox.addItem(oInvoiceBox);

    // Referenzen am Row-Objekt speichern, damit wir sie im Change-Handler finden
    oRow.data("placeholderBoxId", oPlaceholderBox.getId());
    oRow.data("dateBoxId", oDateBox.getId());
    oRow.data("invoiceBoxId", oInvoiceBox.getId());

    // komplette Zeile zusammensetzen
    oRow.addItem(oLeftBox);
    oRow.addItem(oRightBox);

    oContainer.addItem(oRow);
},



    onFilterFieldChange: function (oEvent) {
        const sKey   = oEvent.getSource().getSelectedKey();
        const oRow   = oEvent.getSource().getParent().getParent(); // Select -> left VBox -> Row(HBox)
        const oPHBox = sap.ui.getCore().byId(oRow.data("placeholderBoxId"));
        const oDateBox = sap.ui.getCore().byId(oRow.data("dateBoxId"));
        const oInvBox  = sap.ui.getCore().byId(oRow.data("invoiceBoxId"));

        // rechts die passende Eingabe anzeigen
        oPHBox.setVisible(false);
        oDateBox.setVisible(sKey === "CREATION_DATE");
        oInvBox.setVisible(sKey === "INVOICE_NO");

        // Wenn dies die letzte Zeile ist und ein Filter gewählt wurde -> neue leere Zeile anhängen
        if (sKey) {
            const oContainer = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "filtersContainer");
            const aRows = oContainer.getItems();
            const bIsLastRow = aRows[aRows.length - 1] === oRow;

            if (bIsLastRow) {
                this._addEmptyFilterRow();
            }
        }
    },



    onFilterDialogCancel: function () {
        this._oFilterDialog.close();
    },

    onFilterDialogSave: function () {
        // später: Filterwerte einsammeln & Tabelle filtern
        this._oFilterDialog.close();
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