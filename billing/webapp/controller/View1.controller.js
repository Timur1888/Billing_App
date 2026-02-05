sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "billing/model/formatter",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/CheckBox",
    "sap/m/Popover",
    "sap/m/library",
    "sap/ui/comp/smartvariants/PersonalizableInfo",
    "sap/ui/model/type/String",
    "sap/m/Label",
    "sap/m/SearchField",
    "sap/m/Token",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
    "sap/ui/model/Sorter",
    "sap/m/table/columnmenu/QuickSortItem",
    "billing/util/View1Helper",
    "sap/m/PlacementType",
], function(

    Controller,
    UIComponent,
    JSONModel,
    Filter,
    FilterOperator,
    formatter,
    MessageBox,
    Fragment,
    List,
    CustomListItem,
    HBox,
    CheckBox,
    Popover,
    mLibrary,
    PersonalizableInfo,
    TypeString,
    Label,
    SearchField,
    Token,
    UIColumn,
    MColumn,
    Text,
    Sorter,
    QuickSortItem,
    View1Helper, 
    PlacementType,
) {
    "use strict";

    return Controller.extend("billing.controller.View1", Object.assign({

        formatter: formatter,
        

        onInit: function() {
            var oView = this.getView();
            //------------Modelle-----------------------
            //Backend-Model
            var oBackend = this.getOwnerComponent().getModel("backend");
            oView.setModel(oBackend, "backend");

            //--------------------------------------------------

            //-----------FilterBar----------------------
            this.applyData = this.applyData.bind(this);
            this.fetchData = this.fetchData.bind(this);
            this.getFiltersWithValues = this.getFiltersWithValues.bind(this);

            //Controls einmal holen und als Property merken
            this.oSmartVariantManagement = this.getView().byId("svm");
            this.oExpandedLabel = this.getView().byId("expandedLabel");
            this.oSnappedLabel = this.getView().byId("snappedLabel");

            // XML: <filterModel:FilterBar id="filterbar" ...>
            this.oFilterBar = this.getView().byId("filterbar");

            this.oTable = this.getView().byId("tblBilling");

            // FilterBar mit Variant-Mechanik verbinden
            this.oFilterBar.registerFetchData(this.fetchData);
            this.oFilterBar.registerApplyData(this.applyData);
            this.oFilterBar.registerGetFiltersWithValues(this.getFiltersWithValues);

            // SmartVariantManagement “personalizable” machen
            var oPersInfo = new PersonalizableInfo({
                type: "filterBar",
                keyName: "persistencyKey",
                dataSource: "",
                control: this.oFilterBar
            });
            this.oSmartVariantManagement.addPersonalizableControl(oPersInfo);

            // Initialisieren (Startschuss)
            this.oSmartVariantManagement.initialise(function() {}, this.oFilterBar);
            //--------------------------------------------------

            //--------------------Sortierung----------------------
            this._aColumnMenus = [];
            this._fnItemsBindingChange = null;
            this._attachPerColumnMenus();

            //-----------------------------------------------------
            this._bSvmReady = false;
            this.oSmartVariantManagement.initialise(function () {
            this._bSvmReady = true;
            }.bind(this), this.oFilterBar);
        },

        //::::::::::::::::::::::::::::::::::::::::::::::SOTRIERUNG:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
        onSortChange: function(oEvent) {
            const oTable = this.byId("tblBilling");
            const oBinding = oTable.getBinding("items");

            const oItem = oEvent.getParameter("item"); // QuickSortItem
            const sPath = oItem.getKey();
            const sOrder = oItem.getSortOrder();

            if (sOrder === "None") {
                oBinding.sort();
                return;
            }

            const bDesc = (sOrder === "Descending");
            oBinding.sort([new Sorter(sPath, bDesc)]);
        },
        //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::Filter::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
        //zentrale Funktion, die alle Filter anwendet
        onSearch: async  function(oEvent) {
            if (!this._bSvmReady) {
                return; // nur frühe Init-Searchs blocken
            }
            this.oSmartVariantManagement.currentVariantSetModified(true);
            this.oFilterBar.fireFilterChange(oEvent || {});

            const oFilterM = this.getOwnerComponent().getModel("filterModel");
            const sBaseFilter = "(Process/Manager/Type eq 'ccPM_Billing')";
            const sUserFilter = (this._buildUserFilter(oFilterM) || "").trim();

            if (sUserFilter === "__INVALID__") {
                this.getOwnerComponent().getModel("backend").setProperty("/value", []);
                return;
            }

            // Wenn nichts gesetzt → keine Abfrage
            if (!sUserFilter) {
                sap.m.MessageToast.show("Please set at least one filter");
                // Tabelle leeren (falls vorher Treffer da waren)
                this.getOwnerComponent().getModel("backend").setProperty("/value", []);
                this.oTable.setShowOverlay(false);
                return;
            }

            const sFilter = sUserFilter ? `(${sBaseFilter}) and (${sUserFilter})` : sBaseFilter; //Userfilter leer -> nimm nur Basefilter. Wenn nicht leer, dann nimm beide Filter

            await this._loadInvoicesServer({ top: 40, skip: 0, filter: sFilter, append: false });
            
            this.oTable.setShowOverlay(false);
            // 🔔 KEINE TREFFER
            const aRows = this.getOwnerComponent().getModel("backend").getProperty("/value") || [];
            if (aRows.length === 0) {
                sap.m.MessageToast.show(
                "No results were found for the specified filters"
                );
            }

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



        // suggestion für die Werte aus NettoValue
        onSuggest: function(oEvent) {
            var oSF = oEvent.getSource();
            var oBinding = oSF.getBinding("suggestionItems");

            this.onAddFilter();

            if (!oBinding) {
                return;
            }
            //.replace(/^ccIT_/, "");
            var sValue = (oEvent.getParameter("suggestValue") || oSF.getValue() || "").trim();

            if (!sValue) {
                oBinding.filter([]);
                oSF.suggest();
                return;
            }

            oBinding.filter([
                new sap.ui.model.Filter("text", sap.ui.model.FilterOperator.Contains, sValue)
            ]);
            oSF.suggest();
        },

        //Filterzustand sammeln
        fetchData: function() {
            return this.oFilterBar.getAllFilterItems().reduce(function(aResult, oFilterItem) {
                var oControl = oFilterItem.getControl();
                var vData;

                if (oControl && oControl.getSelectedKeys) {
                    vData = oControl.getSelectedKeys(); // MultiComboBox
                } else if (oControl && oControl.getValue) {
                    vData = oControl.getValue(); // SearchField/Input
                } else {
                    vData = null; // fallback
                }

                aResult.push({
                    groupName: oFilterItem.getGroupName(),
                    fieldName: oFilterItem.getName(),
                    fieldData: vData
                });

                return aResult;
            }, []);
        },

        //Filterzustand anwenden
        applyData: function(aData) {
            aData.forEach(function(oDataObject) {
                var oControl = this.oFilterBar.determineControlByName(oDataObject.fieldName, oDataObject.groupName);
                if (!oControl) {
                    return;
                }

                if (oControl.setSelectedKeys && Array.isArray(oDataObject.fieldData)) {
                    oControl.setSelectedKeys(oDataObject.fieldData);
                } else if (oControl.setValue && typeof oDataObject.fieldData === "string") {
                    oControl.setValue(oDataObject.fieldData);
                }
            }, this);
        },

        //Aktive Filter ermitteln gibt nur die Filter zurück, die aktuell wirklich einen Wert haben
        getFiltersWithValues: function() {
            return this.oFilterBar.getFilterGroupItems().reduce(function(aResult, oFilterGroupItem) {
                var oControl = oFilterGroupItem.getControl();

                // MultiComboBox / Controls mit SelectedKeys
                if (oControl && oControl.getSelectedKeys && oControl.getSelectedKeys().length > 0) {
                    aResult.push(oFilterGroupItem);

                    // Input / SearchField / Controls mit Value
                } else if (oControl && oControl.getValue && oControl.getValue().trim().length > 0) {
                    aResult.push(oFilterGroupItem);

                    // ✅ MultiInput: Tokens zählen als "Filter hat Wert"
                } else if (oControl && oControl.getTokens && oControl.getTokens().length > 0) {
                    aResult.push(oFilterGroupItem);
                }

                return aResult;
            }, []);
        },

        // Neuses Filter wurde hinzugefügt: Variant/Labels aktualisieren
        onAddFilter: function (oEvent) {
        if (this.oSmartVariantManagement?.currentVariantSetModified) {
            this.oSmartVariantManagement.currentVariantSetModified(true);
        }
        if (this.oFilterBar?.fireFilterChange) {
            this.oFilterBar.fireFilterChange(oEvent || {});
        }
        },
        onFilterChange: function() {
            this._updateLabelsAndTable();
        },

        onAfterVariantLoad: function() {
            this._updateLabelsAndTable();
        },

        getFormattedSummaryText: function() {
            var aFiltersWithValues = this.oFilterBar.retrieveFiltersWithValues();

            if (aFiltersWithValues.length === 0) {
                return "No filters active";
            }

            if (aFiltersWithValues.length === 1) {
                return aFiltersWithValues.length + " filter active: " + aFiltersWithValues.join(", ");
            }

            return aFiltersWithValues.length + " filters active: " + aFiltersWithValues.join(", ");
        },

        getFormattedSummaryTextExpanded: function() {
            var aFiltersWithValues = this.oFilterBar.retrieveFiltersWithValues();

            if (aFiltersWithValues.length === 0) {
                return "No filters active";
            }

            var sText = aFiltersWithValues.length + " filters active",
                aNonVisibleFiltersWithValues = this.oFilterBar.retrieveNonVisibleFiltersWithValues();

            if (aFiltersWithValues.length === 1) {
                sText = aFiltersWithValues.length + " filter active";
            }

            if (aNonVisibleFiltersWithValues && aNonVisibleFiltersWithValues.length > 0) {
                sText += " (" + aNonVisibleFiltersWithValues.length + " hidden)";
            }

            return sText;
        },


        //löscht alle Filter
        onClearFilters: function(oEvent) {
            this.getOwnerComponent().getModel("backend").setProperty("/value", []);

            (this.oFilterBar.getFilterGroupItems() || []).forEach(function(oFGI) {
                var oC = oFGI.getControl();
                if (!oC) {
                    return;
                }

                // SearchField/Input
                if (oC.setValue) {
                    oC.setValue("");
                }

                // MultiComboBox
                if (oC.setSelectedKeys) {
                    oC.setSelectedKeys([]);
                }

                // DateRangeSelection
                if (oC.setDateValue) {
                    oC.setDateValue(null);
                }
                if (oC.setSecondDateValue) {
                    oC.setSecondDateValue(null);
                }

                // ValueState reset
                if (oC.setValueState) {
                    oC.setValueState(sap.ui.core.ValueState.None);
                }
                if (oC.setValueStateText) {
                    oC.setValueStateText("");
                }
            });

            this.oSmartVariantManagement.currentVariantSetModified(false);
            this.oFilterBar.fireFilterChange(oEvent || {});
            this.oTable.setShowOverlay(false);
        },

        //-------------------------------------------------------------DateRangeSelection: Factura Date-----------------------------------------
        //wird bei Datumänderung getriggert
        onFacturaDateChange: function(oEvent) {
            var oDRS = oEvent.getSource();
            var sText = (oDRS.getValue() || "").trim();

            // leer -> ok
            if (!sText) {
                oDRS.setValueState(sap.ui.core.ValueState.None);
                oDRS.setValueStateText("");
                this.onAddFilter();
                this._closeDRSPopup(oDRS);
                return;
            }

            // erlaubt: "dd.MM.yyyy - dd.MM.yyyy"
            var aParts = sText.split("-").map(function(x) {
                return x.trim();
            });

            // ange-only erzwingen
            if (aParts.length !== 2) {
                oDRS.setValueState(sap.ui.core.ValueState.Error);
                oDRS.setValueStateText("Please select a date range (from - to).");
                oDRS.setDateValue(null);
                oDRS.setSecondDateValue(null);
                return;
            }

            var rFrom = this._validateDateDDMMYYYY(aParts[0]);
            var rTo = this._validateDateDDMMYYYY(aParts[1]);

            if (!rFrom.ok || !rTo.ok) {
                oDRS.setValueState(sap.ui.core.ValueState.Error);
                oDRS.setValueStateText((!rFrom.ok ? rFrom.msg : rTo.msg) || "Invalid date range.");
                oDRS.setDateValue(null);
                oDRS.setSecondDateValue(null);
                return;
            }

            // Optional: von > bis verhindern
            if (rFrom.date.getTime() > rTo.date.getTime()) {
                oDRS.setValueState(sap.ui.core.ValueState.Error);
                oDRS.setValueStateText("'From' date must be before 'To' date.");
                oDRS.setDateValue(null);
                oDRS.setSecondDateValue(null);
                return;
            }

            // ✅ gültig → Dates setzen
            oDRS.setDateValue(rFrom.date);
            oDRS.setSecondDateValue(rTo.date);

            oDRS.setValueState(sap.ui.core.ValueState.None);
            oDRS.setValueStateText("");

            this.onAddFilter();
            this._closeDRSPopup(oDRS);
        },

        onFacturaDateParseError: function(oEvent) {
            var oDRS = oEvent.getSource();
            oDRS.setValueState(sap.ui.core.ValueState.Error);
            oDRS.setValueStateText("Invalid date format. Use dd.MM.yyyy - dd.MM.yyyy.");
        },

        //::::::::::::::::::::::::::::::::::::::::::::::::::::Allgemeine Funktionen für dieses View::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

        //Beim App-Verlassen löscht alle Abhängigkeiten/Cache
        onExit: function() {
            // 1) Binding detach (ValueHelp rebuild)
            if (this._oItemsBinding && this._fnItemsBindingChange) {
                this._oItemsBinding.detachChange(this._fnItemsBindingChange);
            }
            this._oItemsBinding = null;
            this._fnItemsBindingChange = null;

            // 2) Column header menus destroyen (pro Spalte geladene Fragmente)
            if (Array.isArray(this._aColumnMenus)) {
                this._aColumnMenus.forEach(function(oMenu) {
                    try {
                        oMenu && oMenu.destroy();
                    } catch (e) {}
                });
            }
            this._aColumnMenus = null;

            // 3) (Optional) gemeinsames Menu falls du es noch irgendwo lädst
            if (this._oColumnMenu) {
                try {
                    this._oColumnMenu.destroy();
                } catch (e) {}
            }
            this._oColumnMenu = null;

            // 4) ValueHelp Dialog clean-up
            if (this._oVHD) {
                try {
                    this._oVHD.destroy();
                } catch (e) {}
            }
            this._oVHD = null;

            if (this._oBasicSearchField) {
                try {
                    this._oBasicSearchField.destroy();
                } catch (e) {}
            }
            this._oBasicSearchField = null;

            // 6) Rest 
            this.oModel = null;
            this.oSmartVariantManagement = null;
            this.oExpandedLabel = null;
            this.oSnappedLabel = null;
            this.oFilterBar = null;
            this.oTable = null;
        },

        // Navigation zur Detailseite
        onInvoicePress: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oCtx = oItem.getBindingContext("backend");

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
        // Refreschen
        // ---------------------------------------------------
        onReload: async function () {
        const oComponent = this.getOwnerComponent();
        const oTable     = this.byId("tblBilling");

        if (oTable) {
            oTable.setBusy(true);
        }

        try {
            await oComponent.reloadBackendData();
        } catch (e) {
            console.error("Fehler beim Reload:", e);
        }

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

        // ==========================================================
        // WICHTIG: Panel refreshen, falls es offen war
        // ==========================================================
        try {
            const oMainViewModel = this.getView().getModel("mainView");
            const sLayout = oMainViewModel?.getProperty("/layout");
            const bPanelOpen = !!(sLayout && sLayout !== "OneColumn");
            if (!bPanelOpen) {
            return;
            }

            // Hash: "Details/{invoiceId}"
            const oHashChanger = sap.ui.core.routing.HashChanger.getInstance();
            const sHash = (oHashChanger.getHash() || "").split("?")[0].trim(); // z.B. "Details/90000553"
            const aParts = sHash.split("/").filter(Boolean);

            if (!(aParts.length >= 2 && aParts[0] === "Details")) {
            return;
            }

            const sInvoiceId = decodeURIComponent(aParts[1] || "");
            if (!sInvoiceId) {
            return;
            }

            // ✅ ROBUST: RootControl (App-View) holen und dort layout finden
            const oRoot = oComponent.getRootControl();          // -> App.view.xml Instanz
            const oLayoutCtrl = oRoot && oRoot.byId ? oRoot.byId("layout") : null;

            if (!oLayoutCtrl) {
            console.warn("FCL Layout nicht gefunden über oComponent.getRootControl().byId('layout').");
            // Fallback: DetailsRoute triggern
            oComponent.getRouter().navTo("DetailsRoute", { invoiceId: sInvoiceId }, true);
            return;
            }

            const aMidPages = (oLayoutCtrl.getMidColumnPages && oLayoutCtrl.getMidColumnPages()) || [];
            const oDetailsPage = aMidPages.find(p => typeof p.getController === "function");
            const oDetailsCtrl = oDetailsPage?.getController?.();

            if (oDetailsCtrl?.refreshFromInvoiceId) {
            oDetailsCtrl.refreshFromInvoiceId(sInvoiceId);
            } else {
            // Falls Details-View noch nicht da ist -> navTo
            oComponent.getRouter().navTo("DetailsRoute", { invoiceId: sInvoiceId }, true);
            }

        } catch (e) {
            console.warn("Panel-Refresh nach Reload fehlgeschlagen:", e);
        }
        },

    // ---------------------------------------------------
    // Löschen
    // ---------------------------------------------------
    onSelectionChange: function (oController, oEvent) {
      const oTable        = oEvent.getSource();
      const aSelected     = oTable.getSelectedItems();
      const oDeleteButton = oController.byId("btnDelete");

      if (oDeleteButton) {
        oDeleteButton.setEnabled(aSelected.length > 0);
      }
    },

    onDelete: function (oController) {
      const oTable         = oController.byId("tblBilling");
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

            const oModel = oController.getOwnerComponent().getModel("backend");
            const aData  = oModel.getProperty("/value") || [];

            const aIndices = aSelectedItems.map(function (oItem) {
              const oCtx  = oItem.getBindingContext("backend");
              const sPath = oCtx.getPath(); // z.B. "/value/3"
              return parseInt(sPath.split("/").pop(), 10);
            });

            aIndices
              .sort(function (a, b) { return b - a; })
              .forEach(function (iIndex) {
                aData.splice(iIndex, 1);
              });

            oModel.setProperty("/value", aData);

            oTable.removeSelections(true);
            oController.byId("btnDelete").setEnabled(false);
          }
        }
      );
    },
    }, View1Helper ));
});

