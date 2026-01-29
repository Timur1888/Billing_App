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
    "sap/ui/comp/smartvariants/PersonalizableInfo", "sap/ui/model/type/String", "sap/m/Label", "sap/m/SearchField", "sap/m/Token", "sap/ui/table/Column", "sap/m/Column", "sap/m/Text", "sap/ui/comp/library"
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
    PersonalizableInfo, TypeString, Label, SearchField, Token, UIColumn, MColumn, Text, compLibrary
) {
    "use strict";

    return Controller.extend("billing.controller.View1", {

        formatter: formatter,

        onInit: function () {
            //--------------------------------------------------
            //Backend-Model
            var oBackend = this.getOwnerComponent().getModel("backend");
            this.getView().setModel(oBackend, "backend");

            // ValueHelp-Model
            this.getView().setModel(new JSONModel({
                StatusList: [],
                RecipientNameList: [],
                InvoiceNumberList: [],
                NettoValueList: []
            }), "fb");

            
            //--------------------------------------------------

            //--------------------------------------------------
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
            //--------------------------------------------------

            //--------------------------------------------------
            var oMultiInput;
            // Value Help Dialog standard use case with filter bar without filter suggestions
			oMultiInput = this.byId("multiInputInvNo");
			oMultiInput.addValidator(this._onMultiInputValidate);
			this._oMultiInput = oMultiInput;

            //--------------------------------------------------
        },

// --- VALUE HELP: Invoice .No -------------
		// #region Value Help Dialog standard use case with filter bar without filter suggestions
		onValueHelpRequested: function() {
			this._oBasicSearchField = new SearchField();
			this.loadFragment({
				name: "billing.view.fragments.VH_InvoiceNo"
			}).then(function(oDialog) {
				var oFilterBar = oDialog.getFilterBar(), oColumnInvoiceNo, oColumnRecipientName;
				this._oVHD = oDialog;

				this.getView().addDependent(oDialog);

				// Set key fields for filtering in the Define Conditions Tab
				oDialog.setRangeKeyFields([{
					label: "Invoice .No",
					key: "InvoiceNo",
					type: "string",
					typeInstance: new TypeString({}, {})
				}]);

				// Set Basic Search for FilterBar
				oFilterBar.setFilterBarExpanded(false);
				oFilterBar.setBasicSearch(this._oBasicSearchField);

				// Trigger filter bar search when the basic search is fired
				this._oBasicSearchField.attachSearch(function() {
					oFilterBar.search();
				});

				oDialog.getTableAsync().then(function (oTable) {

					oTable.setModel(this.getView().getModel("fb"), "fb");

					// For Desktop and tabled the default table is sap.ui.table.Table
					if (oTable.bindRows) {
						// Bind rows to the ODataModel and add columns
						oTable.bindAggregation("rows", {
							path: "fb>/InvoiceNumberList",
							events: {
								dataReceived: function() {
									oDialog.update();
								}
							}
						});
						oColumnInvoiceNo = new UIColumn({label: new Label({text: "Invoice No."}), template: new Text({wrapping: false, text: "{fb>InvoiceNo}"})});
						oColumnInvoiceNo.data({
							fieldName: "InvoiceNo"
						});
						oColumnRecipientName = new UIColumn({label: new Label({text: "Recipient Name"}), template: new Text({wrapping: false, text: "{fb>RecipientName}"})});
						oColumnRecipientName.data({
							fieldName: "RecipientName"
						});
						oTable.addColumn(oColumnInvoiceNo);
						oTable.addColumn(oColumnRecipientName);
					}

					// For Mobile the default table is sap.m.Table
					if (oTable.bindItems) {
						// Bind items to the ODataModel and add columns
						oTable.bindAggregation("items", {
							path: "fb>/InvoiceNumberList",
							template: new ColumnListItem({
								cells: [new Label({text: "Invoice No."}), new Label({text: "{fb>InvoiceNo}"})]
							}),
							events: {
								dataReceived: function() {
									oDialog.update();
								}
							}
						});
						oTable.addColumn(new MColumn({header: new Label({text: "Invoice No."})}));
						oTable.addColumn(new MColumn({header: new Label({text: "Recipient Name"})}));
					}
					oDialog.update();
				}.bind(this));

				oDialog.setTokens(this._oMultiInput.getTokens());
				oDialog.open();
			}.bind(this));
		},

onValueHelpOkPress: function (oEvent) {
    var aTokens = oEvent.getParameter("tokens");
    this._oMultiInput.setTokens(aTokens);
    this._oVHD.close();
},

onValueHelpCancelPress: function () {
    this._oVHD.close();
},

onValueHelpAfterClose: function () {
    this._oVHD.destroy();
},

		// #endregion
		onFilterBarSearch: function (oEvent) {
			var sSearchQuery = this._oBasicSearchField.getValue(),
				aSelectionSet = oEvent.getParameter("selectionSet");

			var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
				if (oControl.getValue()) {
					aResult.push(new Filter({
						path: oControl.getName(),
						operator: FilterOperator.Contains,
						value1: oControl.getValue()
					}));
				}

				return aResult;
			}, []);

			aFilters.push(new Filter({
				filters: [
					new Filter({ path: "InvoiceNo", operator: FilterOperator.Contains, value1: sSearchQuery }),
					new Filter({ path: "RecipientName", operator: FilterOperator.Contains, value1: sSearchQuery })
				],
				and: false
			}));

			this._filterTable(new Filter({
				filters: aFilters,
				and: true
			}));
		},

        // @endregion
            _onMultiInputValidate: function (oArgs) {
            if (oArgs.suggestionObject) {
                var o = oArgs.suggestionObject.getBindingContext("fb").getObject();
                return new Token({
                key: o.InvoiceNo,
                text: o.InvoiceNo + " (" + o.RecipientName + ")"
                });
            }
            return null;
            },
		_filterTable: function (oFilter) {
			var oVHD = this._oVHD;

			oVHD.getTableAsync().then(function (oTable) {
				if (oTable.bindRows) {
					oTable.getBinding("rows").filter(oFilter);
				}
				if (oTable.bindItems) {
					oTable.getBinding("items").filter(oFilter);
				}

				// This method must be called after binding update of the table.
				oVHD.update();
			});
		},

//----------------------------------------------------------------------------------------------------------------Drop Down Status und Recipent name--------------------------
        //WICHTIG, Falls ein neuer Filter dazukommt, hier ein neues Property für diesen Filter erstellen. Oder Property löschen falls ein bestehender Fileter gelöscht werden muss
        _rebuildValueHelps: function () {
        var oBackend = this.getView().getModel("backend");
        var oFb      = this.getView().getModel("fb");
        if (!oBackend || !oFb) { return; }

        var aRows = oBackend.getProperty("/value") || [];

        var mStates = Object.create(null);
        var mNames  = Object.create(null);
        var mInv    = Object.create(null); // key = InvoiceNo, value = {InvoiceNo, RecipientName}
        var mNet    = Object.create(null);

        aRows.forEach(function (r) {
          // State
          var sState = r && r.State;
          if (sState) { mStates[sState] = true; }
          // Recipient Name
          var sName = r?.MetaData?.Object?.Data?.Basics?.Recipient?.Name || "";
          if (sName) { mNames[sName] = true; }
          // Invoice No.
          var sInv = r?.MetaData?.Object?.Data?.Basics?.Number?.Value;
          if (sInv != null && sInv !== "") {
            var sInvStr = "" + sInv;
            if (!mInv[sInvStr]) {
              mInv[sInvStr] = { InvoiceNo: sInvStr, RecipientName: sName };
            }
          }
          // Net Amount
          var vNet = r?.MetaData?.Object?.Data?.Amounts?.Net?.Value;
          if (vNet != null && vNet !== "") {
            var sNet = "" + vNet;
            mNet[sNet] = true;
          }
        });

        oFb.setProperty("/StatusList",
            Object.keys(mStates).sort().map(function (s) { return { key: s, text: s }; })
        );

        oFb.setProperty("/RecipientNameList",
            Object.keys(mNames).sort().map(function (s) { return { key: s, text: s }; })
        );

        oFb.setProperty("/InvoiceNumberList",
            Object.keys(mInv).sort().map(function (k) { return mInv[k]; })
        );

        oFb.setProperty("/NettoValueList",
          Object.keys(mNet).sort().map(function (s) { return { key: s, text: s }; })
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

onSearch: function (oEvent) {
    
  var oBinding = this.oTable.getBinding("items");
  if (!oBinding) { return; }

  // Variant als geändert markieren + FilterBar informieren
   this.oSmartVariantManagement.currentVariantSetModified(true);
  this.oFilterBar.fireFilterChange(oEvent || {});

  // Welche Felder sollen global durchsucht werden?
  var aSearchPaths = [
    "MetaData/Object/Data/Basics/Number/Value",
    "MetaData/Object/Data/Basics/Recipient/Name",
    "MetaData/Object/Data/Basics/Recipient/Email/0/Address",
    "MetaData/Object/Data/BusinessPartners/1/LeitwegId/Value",
    "MetaData/Object/Data/BusinessPartners/0/SalesOrganisation/Value"
  ];

  // Mapping: FilterName -> Pfad im backend Row
  var mFieldToPath = {
    State: "State",
    RecipientName: "MetaData/Object/Data/Basics/Recipient/Name",
    InvoiceNo: "MetaData/Object/Data/Basics/Number/Value",
    NettoValue: "MetaData/Object/Data/Amounts/Net/Value",
    FacturaDate: "MetaData/Object/Data/Basics/Date/Value/$date"
  };

  var aFilters = [];

  // A) global SearchFilter (FGI name="Search")
  var oGlobalFGI = this.oFilterBar.getFilterGroupItems().find(function (oFGI) {
    return oFGI.getName() === "Search";
  });

  var sGlobalQuery = "";
  if (oGlobalFGI && oGlobalFGI.getControl() && oGlobalFGI.getControl().getValue) {
    sGlobalQuery = (oGlobalFGI.getControl().getValue() || "").trim();
  }
 oGlobalFGI.getControl.getId
  var oGlobalFilter = this._buildWildcardSearchFilter(sGlobalQuery, aSearchPaths);
  if (oGlobalFilter) {
    aFilters.push(oGlobalFilter);
  }

    // für MultiInput gedacht, evtl. freier Text -> Tokens machen (Go-Click)
    this._finalizeMultiInputTokens();
  // B) alle anderen FilterGroupItems (MultiComboBox + MultiInput + SearchField/Input)
  this.oFilterBar.getFilterGroupItems().forEach(function (oFGI) {
    var sName = oFGI.getName();
    if (sName === "Search") { return; } // global schon behandelt

    var oControl = oFGI.getControl();
    var sPath = mFieldToPath[sName];
    if (!oControl || !sPath) { return; }

    // 1) MultiComboBox
    if (oControl.getSelectedKeys) {
      var aKeys = oControl.getSelectedKeys() || [];
      if (aKeys.length === 0) { return; }

      aFilters.push(new sap.ui.model.Filter({
        filters: aKeys.map(function (sKey) {
          return new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.Contains, sKey);
        }),
        and: false
      }));
      return;
    }
    // 2) MultiInput (Tokens)
    if (oControl.getTokens) {
      var aTokenKeys = (oControl.getTokens() || [])
        .map(function (t) { return t && t.getKey ? (t.getKey() || "").trim() : ""; })
        .filter(Boolean);

      if (aTokenKeys.length === 0) { return; }

      aFilters.push(new sap.ui.model.Filter({
        filters: aTokenKeys.map(function (sKey) {
          // bei InvoiceNo meist Contains oder EQ – du nutzt Contains aktuell
          return new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.Contains, sKey);
        }),
        and: false
      }));
      return;
    }
      //3) DateRangeSelection
      if (oControl.getDateValue && oControl.getSecondDateValue) {
        var dFrom = oControl.getDateValue();        // Date oder null
        var dTo   = oControl.getSecondDateValue();  // Date oder null

        if (!dFrom && !dTo) { return; }

        // JSON hat Millis in $date -> wir filtern numerisch
        var nFrom = dFrom ? dFrom.getTime() : null;
        var nTo   = dTo   ? dTo.getTime()   : null;

        // Wichtig: "bis"-Datum inkl. ganzer Tag (23:59:59.999)
        if (dTo) {
          nTo = new Date(dTo.getFullYear(), dTo.getMonth(), dTo.getDate(), 23, 59, 59, 999).getTime();
        }

        if (nFrom != null && nTo != null) {
          aFilters.push(new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.BT, nFrom, nTo));
        } else if (nFrom != null) {
          aFilters.push(new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.GE, nFrom));
        } else if (nTo != null) {
          aFilters.push(new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.LE, nTo));
        }
        return;
      }
      // 4) SearchField/Input (z.B. RecipientName als Suggest-SearchField etc.)
      if (oControl.getValue) {
      var sVal = (oControl.getValue() || "").trim();
      if (!sVal) { return; }

      if (sName === "NettoValue") {
        // Komma/Space tolerieren
        var n = Number(String(sVal).replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(n)) { return; }

        aFilters.push(new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.EQ, n));
        return;
      }

      var oLocalFilter = this._buildWildcardSearchFilter(sVal, [sPath]);
      if (oLocalFilter) {
          aFilters.push(oLocalFilter);
      }
      return;
      }
  }.bind(this));

  // C) anwenden
  try {
    oBinding.filter(aFilters);
  } finally {
    this.oTable.setShowOverlay(false);
  }
},

_validateDateDDMMYYYY: function (s) {
  // erwartet "dd.MM.yyyy"
  var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s || "");
  if (!m) { return { ok: false }; }

  var d = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var y = parseInt(m[3], 10);

  var yNow = new Date().getFullYear();

  if (mo < 1 || mo > 12) { return { ok: false, msg: "Month must be between 01 and 12." }; }
  if (y > yNow) { return { ok: false, msg: "Year must not be greater than " + yNow + "." }; }
  if (d < 1 || d > 31) { return { ok: false, msg: "Day must be between 01 and 31." }; }

  // echte Datumskonsistenz (z.B. 31.02) prüfen
  var dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) {
    return { ok: false, msg: "Invalid calendar date." };
  }

  return { ok: true, date: dt };
},

onFacturaDateChange: function (oEvent) {
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
  var aParts = sText.split("-").map(function (x) { return x.trim(); });

  // ❗ Range-only erzwingen
  if (aParts.length !== 2) {
    oDRS.setValueState(sap.ui.core.ValueState.Error);
    oDRS.setValueStateText("Please select a date range (from - to).");
    oDRS.setDateValue(null);
    oDRS.setSecondDateValue(null);
    return;
  }

  // 🔎 HIER rufen wir die Funktion auf
  var rFrom = this._validateDateDDMMYYYY(aParts[0]);
  var rTo   = this._validateDateDDMMYYYY(aParts[1]);

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

onFacturaDateParseError: function (oEvent) {
  var oDRS = oEvent.getSource();
  oDRS.setValueState(sap.ui.core.ValueState.Error);
  oDRS.setValueStateText("Invalid date format. Use dd.MM.yyyy - dd.MM.yyyy.");
},

_closeDRSPopup: function (oDRS) {
  var oPopup = oDRS && oDRS.getAggregation && oDRS.getAggregation("_popup");
  if (oPopup && oPopup.isOpen && oPopup.isOpen()) {
    oPopup.close();
  }
},



onSuggest: function (oEvent) {
  var oSF = oEvent.getSource();
  var oBinding = oSF.getBinding("suggestionItems");

  this.onAddFilter();

  if (!oBinding) { return; }

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

//verwandelt die explizite Eingabe (Text) im MultiInput in Tokens
_finalizeMultiInputTokens: function () {
  var oMI = this._oMultiInput || this.byId("multiInput");
  if (!oMI) { return; }

  var sText = (oMI.getValue && oMI.getValue() || "").trim();
  if (!sText) { return; }

  // mehrere Eingaben per Komma erlauben
  var aParts = sText.split(",").map(function (x) { return x.trim(); }).filter(Boolean);

  // vorhandene Token-Keys
  var mExisting = Object.create(null);
  (oMI.getTokens() || []).forEach(function (t) {
    var k = t && t.getKey ? (t.getKey() || "").trim() : "";
    if (k) { mExisting[k] = true; }
  });

  // Quelle: ValueHelp-Liste
  var oFb = this.getView().getModel("fb");
  var aInvList = (oFb && oFb.getProperty("/InvoiceNumberList")) || []; // [{InvoiceNo, RecipientName}, ...]

  // helper: "*9*" -> "9"
  var fnCore = function (s) {
    s = (s || "").trim();
    if (!s) { return ""; }
    var sCore = s.replace(/^\*+/, "").replace(/\*+$/, "");
    return (sCore || "").trim();
  };

  // helper: findet InvoiceNos, die core enthalten (case-insensitive)
  var fnFindMatches = function (sPart) {
    var sCore = fnCore(sPart);
    if (!sCore) { return []; }

    var sNeedle = sCore.toLowerCase();
    return aInvList
      .map(function (x) { return x && x.InvoiceNo != null ? String(x.InvoiceNo) : ""; })
      .filter(Boolean)
      .filter(function (sInv) { return sInv.toLowerCase().indexOf(sNeedle) > -1; });
  };

  aParts.forEach(function (sPart) {
    // Wenn * enthalten oder du generell Pattern zulassen willst:
    var aMatches = fnFindMatches(sPart);

    if (aMatches.length > 0) {
      aMatches.forEach(function (sInv) {
        if (mExisting[sInv]) { return; }
        oMI.addToken(new sap.m.Token({ key: sInv, text: sInv }));
        mExisting[sInv] = true;
      });
      return;
    }

    // Keine Treffer -> als "hartes" Token hinzufügen,
    // damit der Tabellenfilter später 0 Treffer ergibt (Tabelle leer)
    var sFallback = sPart;
    if (!mExisting[sFallback]) {
      oMI.addToken(new sap.m.Token({ key: sFallback, text: sFallback }));
      mExisting[sFallback] = true;
    }
  });
  // Textfeld leeren
  oMI.setValue("");
},

// Nur Variant/Labels aktualisieren
onAddFilter: function (oEvent) {  
  this.oSmartVariantManagement.currentVariantSetModified(true);
  this.oFilterBar.fireFilterChange(oEvent || {});
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


    });
});