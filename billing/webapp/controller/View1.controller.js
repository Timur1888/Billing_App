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
    "sap/m/library",
    "sap/ui/comp/smartvariants/PersonalizableInfo"
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
    mLibrary,
    PersonalizableInfo
) {
    "use strict";

    return Controller.extend("billing.controller.View1", {

        formatter: formatter,

        onInit: function () {
            //Backend-Model
            var oBackend = this.getOwnerComponent().getModel("backend");
            this.getView().setModel(oBackend, "backend");

            // ValueHelp-Model
            this.getView().setModel(new JSONModel({
                StatusList: [],
                RecipientNameList: []
            }), "fb");

            this.applyData = this.applyData.bind(this);
            this.fetchData = this.fetchData.bind(this);
            this.getFiltersWithValues = this.getFiltersWithValues.bind(this);

            //Controls einmal holen und als Property merken
            this.oSmartVariantManagement = this.getView().byId("svm");
            this.oExpandedLabel = this.getView().byId("expandedLabel");
            this.oSnappedLabel = this.getView().byId("snappedLabel");

            // XML: <fb:FilterBar id="filterbar" ...>
            this.oFilterBar = this.getView().byId("filterbar");

            this.oTable = this.getView().byId("tblBilling");

            // Wenn Binding existiert: bei Änderungen ValueHelps neu bauen
            var oItemsBinding = this.oTable && this.oTable.getBinding("items");
            if (oItemsBinding) {
                oItemsBinding.attachChange(this._rebuildValueHelps, this);
            }
            this._rebuildValueHelps();

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
            this.oSmartVariantManagement.initialise(function () {}, this.oFilterBar);
        },

        _rebuildValueHelps: function () {
            var oBackend = this.getView().getModel("backend");
            var oFb = this.getView().getModel("fb");
            if (!oBackend || !oFb) { return; }

            var aRows = oBackend.getProperty("/value") || [];

            // Unique via Map/Object
            var mStates = Object.create(null);
            var mNames  = Object.create(null);

            aRows.forEach(function (r) {
                var sState = r && r.State;
                if (sState) { mStates[sState] = true; }

                var sName = r?.MetaData?.Object?.Data?.Basics?.Recipient?.Name;
                if (sName) { mNames[sName] = true; }
            });

            oFb.setProperty("/StatusList",
                Object.keys(mStates).sort().map(s => ({ key: s, text: s }))
            );

            oFb.setProperty("/RecipientNameList",
                Object.keys(mNames).sort().map(s => ({ key: s, text: s }))
            );
        },

		onExit: function() {
			this.oModel = null;
			this.oSmartVariantManagement = null;
			this.oExpandedLabel = null;
			this.oSnappedLabel = null;
			this.oFilterBar = null;
			this.oTable = null;
		},

        fetchData: function () {
        return this.oFilterBar.getAllFilterItems().reduce(function (aResult, oFilterItem) {
            var oControl = oFilterItem.getControl();
            var vData;

            if (oControl && oControl.getSelectedKeys) {
            vData = oControl.getSelectedKeys();           // MultiComboBox
            } else if (oControl && oControl.getValue) {
            vData = oControl.getValue();                  // SearchField/Input
            } else {
            vData = null;                                 // fallback
            }

            aResult.push({
            groupName: oFilterItem.getGroupName(),
            fieldName: oFilterItem.getName(),
            fieldData: vData
            });

            return aResult;
        }, []);
        },

        applyData: function (aData) {
        aData.forEach(function (oDataObject) {
            var oControl = this.oFilterBar.determineControlByName(oDataObject.fieldName, oDataObject.groupName);
            if (!oControl) { return; }

            if (oControl.setSelectedKeys && Array.isArray(oDataObject.fieldData)) {
            oControl.setSelectedKeys(oDataObject.fieldData);
            } else if (oControl.setValue && typeof oDataObject.fieldData === "string") {
            oControl.setValue(oDataObject.fieldData);
            }
        }, this);
        },

        getFiltersWithValues: function () {
        return this.oFilterBar.getFilterGroupItems().reduce(function (aResult, oFilterGroupItem) {
            var oControl = oFilterGroupItem.getControl();

            if (oControl && oControl.getSelectedKeys && oControl.getSelectedKeys().length > 0) {
            aResult.push(oFilterGroupItem);
            } else if (oControl && oControl.getValue && oControl.getValue().trim().length > 0) {
            aResult.push(oFilterGroupItem);
            }

            return aResult;
        }, []);
        },

		onSFilterSelectionChange: function (oEvent) {
			this.oSmartVariantManagement.currentVariantSetModified(true);
			this.oFilterBar.fireFilterChange(oEvent);
		},

onSearch: function () {
  var oBinding = this.oTable.getBinding("items");
  if (!oBinding) { return; }

  // Welche Felder sollen global durchsucht werden?
  var aSearchPaths = [
    "MetaData/Object/Data/Basics/Number/Value",
    "MetaData/Object/Data/Basics/Recipient/Name",
    "MetaData/Object/Data/Basics/Recipient/Email/0/Address",
    "MetaData/Object/Data/BusinessPartners/1/LeitwegId/Value",
    "MetaData/Object/Data/BusinessPartners/0/SalesOrganisation/Value"
  ];

  // 1) SearchField (global)
  var oSearchFGI = this.oFilterBar.getFilterGroupItems().find(function (oFGI) {
    return oFGI.getName() === "Search";
  });
  var sQuery = "";
  if (oSearchFGI && oSearchFGI.getControl() && oSearchFGI.getControl().getValue) {
    sQuery = (oSearchFGI.getControl().getValue() || "").trim();
  }

  // 2) MultiComboBox Filter (State, RecipientName, etc.) -> falls du sie weiter nutzen willst
  var mFieldToPath = {
    State: "State",
    RecipientName: "MetaData/Object/Data/Basics/Recipient/Name"
  };

  var aFilters = [];

  // A) global SearchFilter bauen (OR über mehrere Felder)
  var oGlobalFilter = this._buildWildcardSearchFilter(sQuery, aSearchPaths);
  if (oGlobalFilter) {
    aFilters.push(oGlobalFilter);
  }

  // B) restliche FilterGroupItems (MultiComboBox)
  this.oFilterBar.getFilterGroupItems().forEach(function (oFGI) {
    var sName = oFGI.getName();
    if (sName === "Search") { return; }

    var oControl = oFGI.getControl();
    if (!oControl || !oControl.getSelectedKeys) { return; }

    var aKeys = oControl.getSelectedKeys();
    var sPath = mFieldToPath[sName];
    if (!sPath || aKeys.length === 0) { return; }

    aFilters.push(new sap.ui.model.Filter({
      filters: aKeys.map(function (sKey) {
        return new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.Contains, sKey);
      }),
      and: false
    }));
  });

  // C) Alles gemeinsam anwenden (AND zwischen global + einzelnen Feldern)
  oBinding.filter(aFilters);
  this.oTable.setShowOverlay(false);
},


//Ermöglicht die Suche mit *
_buildWildcardSearchFilter: function (sQuery, aPaths) {
  if (!sQuery) { return null; }

  var s = (sQuery || "").trim();
  if (!s) { return null; }

  // entferne Rand-* und ignoriere Query nur aus Sternen
  var sCore = s.replace(/^\*+/, "").replace(/\*+$/, "");
  if (!sCore) { return null; }

  // ROBUST: immer Contains, damit JSONModel + Nested Paths sicher matchen
  var op = sap.ui.model.FilterOperator.Contains;

  return new sap.ui.model.Filter({
    filters: aPaths.map(function (sPath) {
      return new sap.ui.model.Filter(sPath, op, sCore);
    }),
    and: false
  });
},

		onFilterChange: function () {
			this._updateLabelsAndTable();
		},

		onAfterVariantLoad: function () {
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

		_updateLabelsAndTable: function () {
			this.oExpandedLabel.setText(this.getFormattedSummaryTextExpanded());
			this.oSnappedLabel.setText(this.getFormattedSummaryText());
			this.oTable.setShowOverlay(true);
		},

//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

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
                placement: mLibrary.Bottom,
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
 

    });
});
