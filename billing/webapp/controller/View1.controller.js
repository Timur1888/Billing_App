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

            const oVariantModel = new sap.ui.model.json.JSONModel({
            currentViewId: "STANDARD",
            views: [
                {
                    id: "STANDARD",
                    name: "Standard",
                    isDefault: true,
                    isPublic: false,
                    autoApply: false,
                    state: {}          // hier später Filter/Sortierung etc.
                }
            ],
            newView: {
                name: "",
                isDefault: false,
                isPublic: false,
                autoApply: false
            }
    });

    this.getView().setModel(oVariantModel, "variant");
        },

        onCreate: function () {},

        // ---------------------------------------------------
        // Refreschen
        // ---------------------------------------------------
        onReload: async function () {
            const oComponent = this.getOwnerComponent();
            const oTable     = this.byId("tblBilling");

            // optional: Busy-Indicator für Tabelle
            if (oTable) {
                oTable.setBusy(true);
            }

            try {
                // neu vom Backend laden
                await oComponent.reloadBackendData();
            } catch (e) {
                console.error("Fehler beim Reload:", e);
            }

            // UI-Zustand zurücksetzen
            if (oTable) {
                oTable.removeSelections(true);
                oTable.setBusy(false);
            }

            const oDeleteButton = this.byId("btnDelete");
            if (oDeleteButton) {
                oDeleteButton.setEnabled(false);
            }

            const oTokenizer = this.byId("filterTokenizer");
            if (oTokenizer) {
                oTokenizer.removeAllTokens();
                oTokenizer.setVisible(false);
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
        // Variant (Ansicht) speichern
        // ---------------------------------------------------

        //Controller für VariantDialog.fragment.xml
        onOpenVariantDialog: function () {
            if (!this._oVariantDialog) {
                this._oVariantDialog = sap.ui.xmlfragment(
                    "billing.view.VariantDialog",
                    this
                );
                this.getView().addDependent(this._oVariantDialog);
            }
            this._oVariantDialog.open();
        },

        onCloseVariantDialog: function () {
            this._oVariantDialog.close();
        },
        
        onVariantSelected: function (oEvent) {
            const oCtx = oEvent.getParameter("listItem").getBindingContext("variant");
            const sId  = oCtx.getProperty("id");
            const oView = oCtx.getObject(); // enthält auch state

            const oVariantModel = this.getView().getModel("variant");
            oVariantModel.setProperty("/currentViewId", sId);
            oVariantModel.setProperty("/currentViewName", oView.name);

            // hier gespeicherten Zustand anwenden
            this._applyState(oView.state || {});
        },

        _applyState: function (oState) {
            const oTokenizer = this.byId("filterTokenizer");

            if (!oTokenizer) {
                return;
            }

            // alle alten Tokens weg
            oTokenizer.removeAllTokens();

            if (!oState || !Array.isArray(oState.tokens)) {
                // sicherheitshalber Filter zurücksetzen
                FilterHelper.applyFiltersFromTokens(this);
                return;
            }

            oState.tokens.forEach(function (oTokState) {
                const sType = oTokState.filterType;
                const oToken = new sap.m.Token({
                    text: oTokState.text,
                    key:  sType,
                    editable: true
                });

                oToken.data("filterType", sType);

                if (sType === "INVOICE_NO") {
                    oToken.data("value", oTokState.value);
                }

                if (sType === "CREATION_DATE") {
                    oToken.data("from", oTokState.from); // Date-Objekte
                    oToken.data("to",   oTokState.to);
                }

                oTokenizer.addToken(oToken);
            });

            // deine bestehende Filterlogik wiederverwenden
            FilterHelper.applyFiltersFromTokens(this);

            // TODO: sorters aus oState.sorters anwenden, sobald du Sortierung hast
        },



        //Controller für SaveViewDialog.fragment.xml
        onSaveViewAs: function () {
            const oModel = this.getView().getModel("variant");

            // Defaults für neue Ansicht setzen
            oModel.setProperty("/newView", {
                name: "",
                isDefault: false,
                isPublic: false,
                autoApply: false
            });

            if (!this._oSaveViewDialog) {
                this._oSaveViewDialog = sap.ui.xmlfragment(
                    "billing.view.SaveViewDialog",
                    this
                );
                this.getView().addDependent(this._oSaveViewDialog);
            }
            this._oSaveViewDialog.open();
        },

        onCancelSaveView: function () {
            this._oSaveViewDialog.close();
        },

        onConfirmSaveView: function () {
            const oModel   = this.getView().getModel("variant");
            const oData    = oModel.getData();
            const oNewView = oData.newView;

            if (!oNewView.name) {
                sap.m.MessageToast.show("Bitte einen Namen eingeben");
                return;
            }

            // aktuellen State einsammeln (Filter, Sortierung, etc.)
            const oState = this._getCurrentState();   // Beispiel-Funktion von oben

            // neue ID (sehr simpel)
            const sId = "V" + (oData.views.length + 1);

            const oView = {
                id: sId,
                name: oNewView.name,
                isDefault: oNewView.isDefault,
                isPublic: oNewView.isPublic,
                autoApply: oNewView.autoApply,
                state: oState
            };

            oData.views.push(oView);
            oData.currentViewId = sId;

            // optional: wenn als Standard, alle anderen Flags zurücksetzen
            if (oNewView.isDefault) {
                oData.views.forEach(v => {
                    v.isDefault = (v.id === sId);
                });
            }

            oModel.refresh(true);
            this._oSaveViewDialog.close();
            this._oVariantDialog.close();

            sap.m.MessageToast.show("Ansicht gespeichert: " + oView.name);
        },

        _getCurrentState: function () {
            const oTokenizer = this.byId("filterTokenizer");

            if (!oTokenizer) {
                return {
                    tokens: [],
                    sorters: [] // später, wenn du Sortierung einbaust
                };
            }

            const aTokens = oTokenizer.getTokens().map(function (oToken) {
                const sType = oToken.data("filterType");

                const oEntry = {
                    filterType: sType,
                    text: oToken.getText()
                };

                // Invoice No.
                if (sType === "INVOICE_NO") {
                    oEntry.value = oToken.data("value");
                }

                // Creation Date
                if (sType === "CREATION_DATE") {
                    oEntry.from = oToken.data("from"); // Date-Objekt
                    oEntry.to   = oToken.data("to");   // Date-Objekt
                }

                return oEntry;
            });

            return {
                tokens: aTokens,
                sorters: [] // noch leer, Sortierung kommt später
            };
        },

    });
});
