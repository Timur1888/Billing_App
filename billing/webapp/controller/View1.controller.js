sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "billing/model/formatter",
    "billing/util/FilterHelper",
    "sap/m/MessageBox",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/CheckBox",
    "sap/m/Popover",
    "sap/m/PlacementType"
], function (
    Controller,
    UIComponent,
    JSONModel,
    Filter,
    FilterOperator,
    formatter,
    FilterHelper,
    MessageBox,
    List,
    CustomListItem,
    HBox,
    CheckBox,
    Popover,
    PlacementType
) {
    "use strict";

    return Controller.extend("billing.controller.View1", {

        formatter: formatter,

        onInit: function () {
            // *** jetzt Backend-Model ***
            var oModel = this.getOwnerComponent().getModel("backend");
            console.log("backend model:", oModel && oModel.getData());

            this._oBackendModel = oModel;

            // falls Daten schon da sind
            this._backupOriginalData();

            // falls Daten asynchron per fetch gesetzt werden:
            if (oModel && oModel.attachEventOnce) {
                // setData() auf JSONModel feuert ein "change"-Event
                oModel.attachEventOnce("change", this._backupOriginalData, this);
            }
        },

        onCreate: function () {},

        // ---------------------------------------------------
        // Refreschen
        // ---------------------------------------------------
        onReload: function () {
            var oModel = this.getOwnerComponent().getModel("backend");
            var oTable = this.byId("tblBilling");

            if (!oModel || !this._aOriginalData) {
                console.warn("Keine Originaldaten für Refresh vorhanden");
                return;
            }

            // Originaldaten wiederherstellen (deep copy)
            var aClone = JSON.parse(JSON.stringify(this._aOriginalData));
            oModel.setProperty("/value", aClone);

            // UI-Zustand zurücksetzen
            if (oTable) {
                oTable.removeSelections(true);
            }
            var oDeleteButton = this.byId("btnDelete");
            if (oDeleteButton) {
                oDeleteButton.setEnabled(false);
            }

            var oTokenizer = this.byId("filterTokenizer");
            if (oTokenizer) {
                oTokenizer.removeAllTokens();
                oTokenizer.setVisible(false);
            }
        },

        _backupOriginalData: function () {
            var oModel = this._oBackendModel || this.getOwnerComponent().getModel("backend");
            if (!oModel) { return; }

            var aData = oModel.getProperty("/value");
            if (aData) {
                this._aOriginalData = JSON.parse(JSON.stringify(aData));
            }
        },

        // ---------------------------------------------------
        // Löschen
        // ---------------------------------------------------
        onSelectionChange: function (oEvent) {
            const oTable        = oEvent.getSource();
            const aSelected     = oTable.getSelectedItems();
            const oDeleteButton = this.byId("btnDelete");

            oDeleteButton.setEnabled(aSelected.length > 0);
        },

        onDelete: function () {
            const oTable         = this.byId("tblBilling");
            const aSelectedItems = oTable.getSelectedItems();

            if (!aSelectedItems.length) {
                return;
            }

            MessageBox.confirm(
                `Do you really want to delete ${aSelectedItems.length} item(s)?`,
                {
                    title: "Confirm Deletion",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.DELETE) {
                            return;
                        }

                        const oModel = this.getOwnerComponent().getModel("backend");
                        const aData  = oModel.getProperty("/value") || [];

                        const aIndices = aSelectedItems.map(function (oItem) {
                            const oCtx  = oItem.getBindingContext("backend");
                            const sPath = oCtx.getPath();   // z.B. "/value/3"
                            return parseInt(sPath.split("/").pop(), 10);
                        });

                        aIndices
                            .sort(function (a, b) { return b - a; })
                            .forEach(function (iIndex) {
                                aData.splice(iIndex, 1);
                            });

                        oModel.setProperty("/value", aData);

                        oTable.removeSelections(true);
                        this.byId("btnDelete").setEnabled(false);
                    }.bind(this)
                }
            );
        },

        // ---------------------------------------------------
        // Suche
        // ---------------------------------------------------
        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query")?.trim().toLowerCase();
            const oTable = this.byId("tblBilling");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            const aFilters = [
                new Filter({
                    path: "MetaData/Object/Data/Basics/Number/Value",
                    operator: FilterOperator.Contains,
                    value1: sQuery
                }),
                new Filter({
                    path: "MetaData/Object/Data/Basics/Recipient/Name",
                    operator: FilterOperator.Contains,
                    value1: sQuery
                }),
                new Filter({
                    path: "MetaData/Object/Data/Basics/Recipient/Email/0/Address",
                    operator: FilterOperator.Contains,
                    value1: sQuery
                })
            ];

            const oCombinedFilter = new Filter({
                filters: aFilters,
                and: false
            });

            const aData = this.getOwnerComponent()
                .getModel("backend")
                .getProperty("/value") || [];

            const aMatches = aData.filter(item => {
                const invoice = String(item.MetaData?.Object?.Data?.Basics?.Number?.Value || "").toLowerCase();
                const name    = String(item.MetaData?.Object?.Data?.Basics?.Recipient?.Name || "").toLowerCase();
                const email   = String(item.MetaData?.Object?.Data?.Basics?.Recipient?.Email?.[0]?.Address || "").toLowerCase();

                return (
                    invoice.includes(sQuery) ||
                    name.includes(sQuery)    ||
                    email.includes(sQuery)
                );
            });

            if (aMatches.length === 0) {
                return;
            }

            oBinding.filter(oCombinedFilter);
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
        // Filter-Button & Dialog
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
        // Status-Formatter
        // ---------------------------------------------------
        formatStatusIcon: function (sState) {
            switch (sState) {
                case "ccDS_Finished":
                    return "sap-icon://paper-plane";
                case "ccDS_UserAction":
                    return "sap-icon://action";
                default:
                    return "sap-icon://question-mark";
            }
        },

        formatStatusState: function (sState) {
            switch (sState) {
                case "ccDS_Finished":
                    return sap.ui.core.ValueState.Success;
                case "ccDS_UserAction":
                    return sap.ui.core.ValueState.Warning;
                default:
                    return sap.ui.core.ValueState.None;
            }
        }

    });
});
