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
            var oModel = this.getOwnerComponent().getModel("backend");
            this._oBackendModel = oModel;

            const oDefaultState = this._getCurrentState();

            const oVariantModel = new JSONModel({
                currentViewId: "STANDARD",
                currentViewName: "Standard",
                views: [{
                    id: "STANDARD",
                    name: "Standard",
                    isDefault: true,
                    isPublic: true,
                    autoApply: false,
                    createdBy: "SAP",
                    state: oDefaultState
                }]
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

        onOpenVariantPopover: function (oEvent) {
            this._ensureAtLeastOneView();

            if (!this._oVariantPopover) {
                this._oVariantPopover = sap.ui.xmlfragment(
                    "billing.view.VariantPopover",
                    this
                );
                this.getView().addDependent(this._oVariantPopover);
            }
            this._oVariantPopover.openBy(oEvent.getSource());
        },

        // Helper: sorgt nur dafür, dass NIE 0 Ansichten existieren
        _ensureAtLeastOneView: function () {
            const oModel = this.getView().getModel("variant");
            if (!oModel) { return; }

            const oData  = oModel.getData() || {};
            oData.views  = Array.isArray(oData.views) ? oData.views : [];

            // wenn gar keine Ansicht mehr existiert -> neue Standardansicht anlegen
            if (oData.views.length === 0) {
                const oState = this._getCurrentState();
                oData.views = [{
                    id: "STANDARD",
                    name: "Standard",
                    isDefault: true,
                    isPublic: true,
                    autoApply: false,
                    createdBy: "SAP",
                    state: oState
                }];
                oData.currentViewId   = "STANDARD";
                oData.currentViewName = "Standard";
                oModel.setData(oData);
                this._applyState(oState);
            }
        },

        // Helper: stellt sicher, dass die Standard-Ansicht immer existiert
        _ensureStandardView: function () {
            const oModel = this.getView().getModel("variant");
            if (!oModel) { return; }

            const oData = oModel.getData() || {};
            oData.views = Array.isArray(oData.views) ? oData.views : [];

            if (oData.views.length === 0) {
                const oState = this._getCurrentState();
                oData.views = [{
                    id: "STANDARD",
                    name: "Standard",
                    isDefault: true,
                    isPublic: true,
                    autoApply: false,
                    createdBy: "SAP",
                    state: oState
                }];
                oData.currentViewId   = "STANDARD";
                oData.currentViewName = "Standard";
                oModel.setData(oData);
                this._applyState(oState);
                return;
            }

            const bHasStandard = oData.views.some(v => v.id === "STANDARD");
            if (!bHasStandard) {
                const oState = this._getCurrentState();
                oData.views.unshift({
                    id: "STANDARD",
                    name: "Standard",
                    isDefault: !oData.views.some(v => v.isDefault),
                    isPublic: true,
                    autoApply: false,
                    createdBy: "SAP",
                    state: oState
                });
                oModel.setData(oData);
            }
        },

        onOpenManageDialog: function () {
            // Kopie der aktuellen Varianten erstellen
            const oVariantModel = this.getView().getModel("variant");
            const aViews        = oVariantModel.getProperty("/views") || [];
            const aCopy         = JSON.parse(JSON.stringify(aViews));

            if (!this._oManageModel) {
                this._oManageModel = new sap.ui.model.json.JSONModel();
            }
            this._oManageModel.setData({ views: aCopy });

            if (!this._oManageDialog) {
                this._oManageDialog = sap.ui.xmlfragment(
                    "billing.view.ManageVariants",
                    this
                );
                this.getView().addDependent(this._oManageDialog);
            }

            this._oManageDialog.setModel(this._oManageModel, "variantManage");
            this._oManageDialog.open();
        },

        onCloseManageDialog: function () {
            this._oManageDialog.close();
        },

        onVariantDelete: function (oEvent) {
            const oCtx         = oEvent.getSource().getBindingContext("variantManage");
            const bIsDefault   = oCtx.getProperty("isDefault");
            const oManageModel = this._oManageModel;
            let   aViews       = oManageModel.getProperty("/views") || [];

            // aktuelle Standardansicht darf nicht gelöscht werden
            if (bIsDefault) {
                sap.m.MessageToast.show("Die Standardansicht kann nicht gelöscht werden.");
                return;
            }

            // es muss mindestens eine Ansicht übrig bleiben
            if (aViews.length <= 1) {
                sap.m.MessageToast.show("Es muss mindestens eine Ansicht vorhanden sein.");
                return;
            }

            // Index aus dem Pfad ermitteln (z.B. "/views/3" -> 3)
            const sPath   = oCtx.getPath();
            const sIndex  = sPath.split("/").pop();
            const iIndex  = parseInt(sIndex, 10);

            if (!isNaN(iIndex) && iIndex >= 0 && iIndex < aViews.length) {
                aViews.splice(iIndex, 1);
                oManageModel.setProperty("/views", aViews);
            }
        },

        onVariantDefaultToggle: function (oEvent) {
            const oCtx         = oEvent.getSource().getBindingContext("variantManage");
            const sId          = oCtx.getProperty("id");
            const oManageModel = this._oManageModel;
            const aViews       = oManageModel.getProperty("/views") || [];

            aViews.forEach(v => {
                v.isDefault = (v.id === sId);
            });

            oManageModel.setProperty("/views", aViews);
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
            const oTable     = this.byId("tblBilling");

            // -------- Tokens / Filter ----------
            if (oTokenizer) {
                oTokenizer.removeAllTokens();

                if (oState && Array.isArray(oState.tokens)) {
                    oState.tokens.forEach(function (oTokState) {
                        const sType  = oTokState.filterType;
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
                            oToken.data("from", oTokState.from);
                            oToken.data("to",   oTokState.to);
                        }

                        oTokenizer.addToken(oToken);
                    });
                }

                // deine bestehende Filterlogik wiederverwenden
                FilterHelper.applyFiltersFromTokens(this);
            }

            // -------- Spalten-Sichtbarkeit ----------
            if (oTable && oState && Array.isArray(oState.columns)) {
                const aCols = oTable.getColumns();

                oState.columns.forEach(function (oColState) {
                    const oCol = aCols.find(function (c) {
                        return c.getId() === oColState.id;
                    });

                    if (oCol) {
                        oCol.setVisible(!!oColState.visible);
                    }
                });
            }

            // Column-Settings-Popover neu aufbauen, damit die Checkboxen passen
            if (this._oColumnPopover) {
                this._oColumnPopover.destroy();
                this._oColumnPopover = null;
            }

            // sorters aus oState.sorters kommen später dazu
        },

        onManageSearch: function (oEvent) {
            const sQuery = (oEvent.getSource().getValue() || "").toLowerCase();

            const oTable   = sap.ui.getCore().byId("tblManageVariants");
            const oBinding = oTable && oTable.getBinding("items");
            if (!oBinding) { return; }

            const aFilters = [];
            if (sQuery) {
                aFilters.push(new Filter("name", FilterOperator.Contains, sQuery));
            }
            oBinding.filter(aFilters);
        },


        //Controller für SaveViewDialog.fragment.xml
        onSaveViewAs: function () {
            const oModel = this.getView().getModel("variant");

            // Defaults für neue Ansicht setzen
            oModel.setProperty("/newView", {
                name: "",
                isDefault: false,
                isPivate: false,
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

            // Eingabe trimmen (entfernt Leerzeichen am Anfang/Ende)
            const sName = (oNewView.name || "").trim();

            // Input-Feld holen
            const oInput = sap.ui.getCore().byId("inpViewName");

            // Validierung
            if (!sName || sName.length === 0) {
                if (oInput) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Bitte einen Namen eingeben");
                }
                sap.m.MessageToast.show("Bitte einen Namen eingeben");
                return;
            }

            // Falls vorher ein Fehler angezeigt wurde → zurücksetzen
            if (oInput) {
                oInput.setValueState("None");
            }

            // aktuellen State einsammeln (Filter, Sortierung, etc.)
            const oState = this._getCurrentState();

            // neue ID erstellen
            const sId = "V" + (oData.views.length + 1);

            const oView = {
                id: sId,
                name: sName,
                isDefault: oNewView.isDefault,
                isPrivate: oNewView.isPrivate,
                autoApply: oNewView.autoApply,
                createdBy: "Sie",
                state: oState
            };

            oData.views.push(oView);
            oData.currentViewId = sId;

            // Falls Standard gesetzt → andere deaktivieren
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
            const oTable     = this.byId("tblBilling");

            // --- Tokens (Filter) sichern ---
            const aTokensState = oTokenizer ? oTokenizer.getTokens().map(function (oToken) {
                const sType = oToken.data("filterType");

                const oEntry = {
                    filterType: sType,
                    text: oToken.getText()
                };

                if (sType === "INVOICE_NO") {
                    oEntry.value = oToken.data("value");
                }

                if (sType === "CREATION_DATE") {
                    oEntry.from = oToken.data("from");
                    oEntry.to   = oToken.data("to");
                }

                return oEntry;
            }) : [];

            // --- Spalten-Sichtbarkeit sichern ---
            let aColumnsState = [];
            if (oTable) {
                aColumnsState = oTable.getColumns().map(function (oCol) {
                    return {
                        id: oCol.getId(),          // eindeutige ID der Spalte
                        visible: oCol.getVisible() // true/false
                    };
                });
            }

            return {
                tokens:  aTokensState,
                sorters: [],          // später für Sortierung
                columns: aColumnsState
            };
        },



        onManageSave: function () {
            const oVariantModel = this.getView().getModel("variant");
            const oManageModel  = this._oManageModel;

            const aViews = oManageModel.getProperty("/views") || [];

            if (!aViews.length) {
                sap.m.MessageToast.show("Es muss mindestens eine Ansicht vorhanden sein.");
                return;
            }

            // sicherstellen, dass genau eine Default-Ansicht existiert
            let oDefault = aViews.find(v => v.isDefault);
            if (!oDefault) {
                oDefault = aViews[0];
                aViews.forEach(v => v.isDefault = (v === oDefault));
            }

            // Kopie zurück ins Haupt-Model schreiben
            oVariantModel.setProperty("/views", aViews);
            oVariantModel.setProperty("/currentViewId",   oDefault.id);
            oVariantModel.setProperty("/currentViewName", oDefault.name);

            this._applyState(oDefault.state || {});

            if (this._oManageDialog) {
                this._oManageDialog.close();
            }
        },
        onCloseManageDialog: function () {
            if (this._oManageDialog) {
                this._oManageDialog.close();
            }
            // _oManageModel bleibt bestehen, wird beim nächsten Öffnen neu überschrieben
        },

    });
});
