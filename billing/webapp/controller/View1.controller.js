sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "billing/model/formatter",
    "sap/m/MessageBox",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/CheckBox",
    "sap/m/Popover",
    "sap/m/PlacementType",
    "billing/util/FilterHelper",
    "billing/util/ViewsHelper",
    "billing/util/MainViewButtonsHelper"
], function (
    Controller,
    UIComponent,
    JSONModel,
    Filter,
    FilterOperator,
    formatter,
    MessageBox,
    List,
    CustomListItem,
    HBox,
    CheckBox,
    Popover,
    PlacementType,
    FilterHelper,
    ViewsHelper,
    MainViewButtonsHelper
) {
    "use strict";

    return Controller.extend("billing.controller.View1", {

        formatter: formatter,

        onInit: function () {
            var oModel = this.getOwnerComponent().getModel("backend");
            this._oBackendModel = oModel;

            ViewsHelper.initVariantModel(this);
        },


        onCreate: function () {},

        // ---------------------------------------------------
        // Refreschen -> MainViewButtonsHelper.js
        // ---------------------------------------------------
        onReload: function () {
        return MainViewButtonsHelper.onReload(this);
        },

        // ---------------------------------------------------
        // Löschen -> MainViewButtonsHelper.js
        // ---------------------------------------------------
        onSelectionChange: function (oEvent) {
        return MainViewButtonsHelper.onSelectionChange(this, oEvent);
        },

        onDelete: function () {
        return MainViewButtonsHelper.onDelete(this);
        },

        // ---------------------------------------------------
        // Suche -> MainViewButtonsHelper.js
        // ---------------------------------------------------
        onSearch: function (oEvent) {
        return MainViewButtonsHelper.onSearch(this, oEvent);
        },

        // ---------------------------------------------------
        // Navigation zur Detailseite
        // ---------------------------------------------------
        onInvoicePress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oCtx  = oItem.getBindingContext("backend");

            if (!oCtx) {
                console.error("Kein BindingContext für Model 'backend' gefunden");
                return;
            }

            const sInvoiceId = oCtx.getProperty("MetaData/Object/Data/Basics/Number/Value");

            const oMainViewModel = this.getView().getModel("mainView");
            oMainViewModel.setProperty("/layout", "TwoColumnsBeginExpanded");

            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("DetailsRoute", {
                invoiceId: sInvoiceId
            });
        },

        // ---------------------------------------------------
        // Filter-Button & Dialog -> FilterHelper.js
        // ---------------------------------------------------
        onFilter: function (oEvent) {
            const oPopover = FilterHelper.createFilterPopover(this);
            oPopover.openBy(oEvent.getSource());
        },

        onAddFilterPress: function () {
            if (this._oFilterPopover) {
                this._oFilterPopover.close();
            }
            FilterHelper.openFilterDialog(this);
        },

        onFilterFieldChange: function (oEvent) {
            FilterHelper.onFilterFieldChange(this, oEvent);
        },

        onFilterRowDelete: function (oEvent) {
            FilterHelper.onFilterRowDelete(this, oEvent);
        },

        onFilterDialogSave: function () {
            FilterHelper.onFilterDialogSave(this);
        },

        onFilterDialogCancel: function () {
            if (this._oFilterDialog) {
                this._oFilterDialog.close();
            }
        },

        onFilterTokenChange: function (oEvent) {
            FilterHelper.onFilterTokenChange(this, oEvent);
        },

        // ---------------------------------------------------
        // Settings-Button (Spalten ein-/ausblenden)
        // ---------------------------------------------------
        _createColumnSettingsPopover: function () {
            if (this._oColumnPopover) {
                return this._oColumnPopover;
            }

            const oTable   = this.byId("tblBilling");
            const aColumns = oTable.getColumns();

            const oList = new List({
                items: aColumns.map(col => {
                    const sColLabel = col.getHeader().getText();

                    return new CustomListItem({
                        content: new HBox({
                            items: [
                                new CheckBox({
                                    selected: col.getVisible(),
                                    text: sColLabel,
                                    select: function (oEvent) {
                                        const bSelected = oEvent.getParameter("selected");
                                        col.setVisible(bSelected);
                                    }
                                }).addStyleClass("sapUiSmallMarginEnd")
                            ]
                        })
                    });
                })
            });

            this._oColumnPopover = new Popover({
                placement: PlacementType.Bottom,
                title: "Columns",
                contentWidth: "250px",
                content: oList
            });

            this.getView().addDependent(this._oColumnPopover);

            return this._oColumnPopover;
        },

        onSettings: function (oEvent) {
            const oPopover = this._createColumnSettingsPopover();
            oPopover.openBy(oEvent.getSource());
        },
        // ---------------------------------------------------
        // Variant UI-Handler -> ViewsHelper
        // ---------------------------------------------------
        onOpenVariantPopover: function (oEvent) {
        ViewsHelper.openVariantPopover(this, oEvent);
        },

        _ensureAtLeastOneView: function () {
            ViewsHelper.ensureAtLeastOneView(this);
        },

        onOpenManageDialog: function () {
            ViewsHelper.openManageDialog(this);
        },

        onCloseManageDialog: function () {
            ViewsHelper.closeManageDialog(this);
        },

        onVariantDelete: function (oEvent) {
            ViewsHelper.variantDelete(this, oEvent);
        },

        onVariantDefaultToggle: function (oEvent) {
            ViewsHelper.variantDefaultToggle(this, oEvent);
        },

        onCloseVariantDialog: function () {
            ViewsHelper.closeVariantDialog(this);
        },

        onVariantSelected: function (oEvent) {
            ViewsHelper.variantSelected(this, oEvent);
        },

        _applyState: function (oState) {
            ViewsHelper.applyState(this, oState);
        },

        onManageSearch: function (oEvent) {
            ViewsHelper.manageSearch(this, oEvent);
        },

        onSaveViewAs: function () {
            ViewsHelper.saveViewAs(this);
        },

        onCancelSaveView: function () {
            ViewsHelper.cancelSaveView(this);
        },

        onConfirmSaveView: function () {
            ViewsHelper.confirmSaveView(this);
        },

        _getCurrentState: function () {
            return ViewsHelper.getCurrentState(this);
        },

        onManageSave: function () {
            ViewsHelper.manageSave(this);
        }

    });
});
