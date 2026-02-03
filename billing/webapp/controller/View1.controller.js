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
    "billing/util/View1Helper"

], function(
    Controller,
    UIComponent,
    JSONModel,
    Filter,
    FilterOperator,
    Formatter,
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
    View1Helper
) {
    "use strict";

    return Controller.extend("billing.controller.View1", Object.assign({

        formatter: Formatter,
        

        onInit: function() {
            var oView = this.getView();
            //------------Modelle-----------------------
            //Backend-Model
            var oBackend = this.getOwnerComponent().getModel("backend");
            oView.setModel(oBackend, "backend");

            // ValueHelp-Model
            oView.setModel(new JSONModel({
                StatusList: [],
                RecipientNameList: [],
                InvoiceNumberList: [],
                NettoValueList: []
            }), "filterModel");

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
            this.oSmartVariantManagement.initialise(function() {}, this.oFilterBar);
            //--------------------------------------------------

            //--------------------MultiInput---------------------
            var oMultiInput;
            // Value Help Dialog standard use case with filter bar without filter suggestions
            oMultiInput = this.byId("multiInputInvNo");
            oMultiInput.addValidator(this._onMultiInputValidate);
            this._oMultiInput = oMultiInput;

            //--------------------Sortierung----------------------
            this._aColumnMenus = [];
            this._fnItemsBindingChange = null;
            this._attachPerColumnMenus();
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
        onSearch: function(oEvent) {

            var oBinding = this.oTable.getBinding("items");
            if (!oBinding) {
                return;
            }

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
            var oGlobalFGI = this.oFilterBar.getFilterGroupItems().find(function(oFGI) {
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
            this.oFilterBar.getFilterGroupItems().forEach(function(oFGI) {
                var sName = oFGI.getName();
                if (sName === "Search") {
                    return;
                } // global schon behandelt

                var oControl = oFGI.getControl();
                var sPath = mFieldToPath[sName];
                if (!oControl || !sPath) {
                    return;
                }

                // 1) MultiComboBox
                if (oControl.getSelectedKeys) {
                    var aKeys = oControl.getSelectedKeys() || [];
                    if (aKeys.length === 0) {
                        return;
                    }

                    aFilters.push(new sap.ui.model.Filter({
                        filters: aKeys.map(function(sKey) {
                            return new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.Contains, sKey);
                        }),
                        and: false
                    }));
                    return;
                }
                // 2) MultiInput (Tokens)
                if (oControl.getTokens) {
                    var aTokenKeys = (oControl.getTokens() || [])
                        .map(function(t) {
                            return t && t.getKey ? (t.getKey() || "").trim() : "";
                        })
                        .filter(Boolean);

                    if (aTokenKeys.length === 0) {
                        return;
                    }

                    aFilters.push(new sap.ui.model.Filter({
                        filters: aTokenKeys.map(function(sKey) {
                            // bei InvoiceNo meist Contains oder EQ – du nutzt Contains aktuell
                            return new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.Contains, sKey);
                        }),
                        and: false
                    }));
                    return;
                }
                //3) DateRangeSelection
                if (oControl.getDateValue && oControl.getSecondDateValue) {
                    var dFrom = oControl.getDateValue(); // Date oder null
                    var dTo = oControl.getSecondDateValue(); // Date oder null

                    if (!dFrom && !dTo) {
                        return;
                    }

                    // JSON hat Millis in $date -> wir filtern numerisch
                    var nFrom = dFrom ? dFrom.getTime() : null;
                    var nTo = dTo ? dTo.getTime() : null;

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
                    if (!sVal) {
                        return;
                    }

                    if (sName === "NettoValue") {

                        // ⭐ 1) Wildcard explizit erlauben → NICHT returnen
                        if (sVal.includes("*")) {
                            var sNeedle = sVal.replace(/\*/g, "").trim(); // "*3*" -> "3"

                            // nur "*" => keine Einschränkung
                            if (!sNeedle) {
                            return;
                            }

                            aFilters.push(new sap.ui.model.Filter({
                            path: sPath,
                            test: function (v) {
                                if (v === null || v === undefined) { return false; }
                                return String(v).includes(sNeedle);     //wir verwandeln hier die Int Werte aus der Tabelle in String und vergleichen dann
                            }
                            }));
                            return;
                        }

                        // ⭐ 2) Komma & Spaces tolerieren
                        var n = Number(String(sVal).replace(/\s/g, "").replace(",", "."));

                        // ⭐ 3) Ungültige Zahl → nichts kaputt machen
                        if (!Number.isFinite(n)) {
                            return;
                        }

                        aFilters.push(
                            new sap.ui.model.Filter(sPath, sap.ui.model.FilterOperator.EQ, n)
                        );
                        return;
                    }

                    // Standard-Fall (Strings etc.)
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

        // suggestion für die Werte aus NettoValue
        onSuggest: function(oEvent) {
            var oSF = oEvent.getSource();
            var oBinding = oSF.getBinding("suggestionItems");

            this.onAddFilter();

            if (!oBinding) {
                return;
            }

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
        onAddFilter: function(oEvent) {
            this.oSmartVariantManagement.currentVariantSetModified(true);
            this.oFilterBar.fireFilterChange(oEvent || {});
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
            var oBinding = this.oTable.getBinding("items");
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

                // MultiInput
                if (oC.removeAllTokens) {
                    oC.removeAllTokens();
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
            if (oBinding) {
                oBinding.filter([]);
            }
        },

        // ---------------------------------------------------------- MultiInput: Invoice .No ------------------------------------------------------------------
        //Aktiviert den Dialog (Fragment) für MultiInput
        onValueHelpRequested: function() {
            this._oBasicSearchField = new SearchField();
            this.loadFragment({
                name: "billing.view.fragments.VH_InvoiceNo"
            }).then(function(oDialog) {
                var oFilterBar = oDialog.getFilterBar(),
                    oColumnInvoiceNo, oColumnRecipientName;
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

                oDialog.getTableAsync().then(function(oTable) {

                    oTable.setModel(this.getView().getModel("filterModel"), "filterModel");

                    // For Desktop and tabled the default table is sap.ui.table.Table
                    if (oTable.bindRows) {
                        // Bind rows to the ODataModel and add columns
                        oTable.bindAggregation("rows", {
                            path: "filterModel>/InvoiceNumberList",
                            events: {
                                dataReceived: function() {
                                    oDialog.update();
                                }
                            }
                        });
                        oColumnInvoiceNo = new UIColumn({
                            label: new Label({
                                text: "Invoice No."
                            }),
                            template: new Text({
                                wrapping: false,
                                text: "{filterModel>InvoiceNo}"
                            })
                        });
                        oColumnInvoiceNo.data({
                            fieldName: "InvoiceNo"
                        });
                        oColumnRecipientName = new UIColumn({
                            label: new Label({
                                text: "Recipient Name"
                            }),
                            template: new Text({
                                wrapping: false,
                                text: "{filterModel>RecipientName}"
                            })
                        });
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
                            path: "filterModel>/InvoiceNumberList",
                            template: new ColumnListItem({
                                cells: [new Label({
                                    text: "Invoice No."
                                }), new Label({
                                    text: "{filterModel>InvoiceNo}"
                                })]
                            }),
                            events: {
                                dataReceived: function() {
                                    oDialog.update();
                                }
                            }
                        });
                        oTable.addColumn(new MColumn({
                            header: new Label({
                                text: "Invoice No."
                            })
                        }));
                        oTable.addColumn(new MColumn({
                            header: new Label({
                                text: "Recipient Name"
                            })
                        }));
                    }
                    oDialog.update();
                }.bind(this));

                oDialog.setTokens(this._oMultiInput.getTokens());
                oDialog.open();
            }.bind(this));
        },

        //schließt das Fragment beim OK-Klick
        onValueHelpOkPress: function(oEvent) {
            var aTokens = oEvent.getParameter("tokens");
            this._oMultiInput.setTokens(aTokens);
            this._oVHD.close();
        },
        //schließt das Fragment beim Cancel-Klick
        onValueHelpCancelPress: function() {
            this._oVHD.close();
        },
        //löscht die Daten des Fragmentes
        onValueHelpAfterClose: function() {
            this._oVHD.destroy();
        },

        // Ermöglicht die Suche nach den Filtern innerhalb des Fragmentes
        onFilterBarSearch: function(oEvent) {
            var sSearchQuery = this._oBasicSearchField.getValue(),
                aSelectionSet = oEvent.getParameter("selectionSet");

            var aFilters = aSelectionSet.reduce(function(aResult, oControl) {
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
                    new Filter({
                        path: "InvoiceNo",
                        operator: FilterOperator.Contains,
                        value1: sSearchQuery
                    }),
                    new Filter({
                        path: "RecipientName",
                        operator: FilterOperator.Contains,
                        value1: sSearchQuery
                    })
                ],
                and: false
            }));

            this._filterTable(new Filter({
                filters: aFilters,
                and: true
            }));
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

            // 5) MultiInput Validator entfernen (optional aber sauber)
            if (this._oMultiInput && this._onMultiInputValidate) {
                try {
                    this._oMultiInput.removeValidator(this._onMultiInputValidate);
                } catch (e) {}
            }
            this._oMultiInput = null;

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
        // Refreschen der Daten aus Backend 
        onReload: async function() {
            const oComponent = this.getOwnerComponent();
            const oTable = this.byId("tblBilling");

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
    }, View1Helper ));
});