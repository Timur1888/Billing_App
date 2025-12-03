sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/Locale"
], (Controller, UIComponent, JSONModel, NumberFormat, Locale ) => {
    "use strict";

    return Controller.extend("billing.controller.View1", {
        onInit() {
//        var oModel = new JSONModel();
//        this.getView().setModel(oModel, "billings");
          var oModel = this.getOwnerComponent().getModel("testData");
            console.log("testData:", oModel && oModel.getData());
        },

        onCreate() {},

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query")?.trim().toLowerCase();
            const oTable = this.byId("tblBilling");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            // Wenn Suchfeld leer → alle anzeigen
            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            // --- Filter definieren ---
            const aFilters = [
                new sap.ui.model.Filter({
                    path: "MetaData/Object/Data/Basics/Number/Value",
                    operator: sap.ui.model.FilterOperator.Contains,
                    value1: sQuery
                }),
                new sap.ui.model.Filter({
                    path: "MetaData/Object/Data/Basics/Recipient/Name",
                    operator: sap.ui.model.FilterOperator.Contains,
                    value1: sQuery
                }),
                new sap.ui.model.Filter({
                    path: "MetaData/Object/Data/Basics/Recipient/Email/0/Address",
                    operator: sap.ui.model.FilterOperator.Contains,
                    value1: sQuery
                })
            ];

            const oCombinedFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: false
            });

            // --- Precheck: Treffer prüfen ---
            const aData = this.getOwnerComponent().getModel("testData").getProperty("/value");

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

            // Keine Treffer → Tabelle unverändert lassen
            if (aMatches.length === 0) {
                return;
            }

            // Treffer → Tabelle filtern
            oBinding.filter(oCombinedFilter);
        },
        onInvoicePress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");

           
            const oCtx = oItem.getBindingContext("testData");
            if (!oCtx) {
                console.error("Kein BindingContext für Model 'testData' gefunden");
                return;
            }

            // Pfad ist relativ zum Context "/value/…"
            const sInvoiceId = oCtx.getProperty("MetaData/Object/Data/Basics/Number/Value");
            // optional: trimmen, falls hinten Leerzeichen
            // const sInvoiceId = (oCtx.getProperty("MetaData/Object/Data/Basics/Number/Value") || "").trim();

            // Layout auf 2 Spalten stellen
            const oMainViewModel = this.getView().getModel("mainView");
            oMainViewModel.setProperty("/layout", "TwoColumnsBeginExpanded");

            // Router holen und zur Details-Route navigieren
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("DetailsRoute", {
                invoiceId: sInvoiceId

      });
    },

//--------------------------------------------------------------------------------------Filter-Button---------------------------------------------------------------------------------
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
            alignItems: "End",
            class: "sapUiSmallMarginBottom"
        });

        // ===== links: Select Filter =====
        const oLeftBox = new sap.m.VBox({ width: "45%" });
        oLeftBox.addItem(new sap.m.Label({
            text: "Select Filter",
            class: "sapUiTinyMarginBottom"
        }));

        const oSelect = new sap.m.Select({
            width: "100%",
            selectedKey: "",        // initial leer
            forceSelection: false,  // leer erlaubt
            change: this.onFilterFieldChange.bind(this)
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

        // ===== Mitte: Platzhalter / DateRange / InvoiceNo =====
        const oRightBox = new sap.m.VBox({ width: "45%" });

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

        // ===== rechts: X-Button zum Löschen =====
        const oDeleteBtn = new sap.m.Button({
            icon: "sap-icon://decline",
            type: "Transparent",
            tooltip: "Remove filter",
            press: this.onFilterRowDelete.bind(this)
        });

        // Referenzen am Row-Objekt speichern, damit wir sie im Change-Handler finden
        oRow.data("placeholderBoxId", oPlaceholderBox.getId());
        oRow.data("dateBoxId", oDateBox.getId());
        oRow.data("invoiceBoxId", oInvoiceBox.getId());

        // komplette Zeile zusammensetzen
        oRow.addItem(oLeftBox);
        oRow.addItem(oRightBox);
        oRow.addItem(oDeleteBtn);

        oContainer.addItem(oRow);
        this._updateDeleteButtons();

    },

    _updateDeleteButtons: function () {
        const oContainer = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "filtersContainer");
        const aRows = oContainer.getItems();
        const iLastIndex = aRows.length - 1;

        aRows.forEach(function (oRow, iIndex) {
            const aItems = oRow.getItems();
            const oBtn = aItems[aItems.length - 1]; // letztes Item = X-Button

            if (oBtn instanceof sap.m.Button) {
                // Letzte Zeile: NIE löschbar (immer ausgegraut)
                if (iIndex === iLastIndex) {
                    oBtn.setEnabled(false);
                } else {
                    oBtn.setEnabled(true);
                }
            }
        });
    },

    onFilterRowDelete: function (oEvent) {
        const oBtn = oEvent.getSource();
        const oRow = oBtn.getParent();
        const oContainer = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "filtersContainer");
        const aRows = oContainer.getItems();

        const iIndex = aRows.indexOf(oRow);
        const iLastIndex = aRows.length - 1;

        // Letzte Zeile nie löschen
        if (iIndex === iLastIndex) {
            return;
        }

        oContainer.removeItem(oRow);
        oRow.destroy();

        this._updateDeleteButtons();
    },

    onFilterFieldChange: function (oEvent) {
        const sKey   = oEvent.getSource().getSelectedKey();
        const oRow   = oEvent.getSource().getParent().getParent(); // Select -> VBox -> HBox

        const oPHBox   = sap.ui.getCore().byId(oRow.data("placeholderBoxId"));
        const oDateBox = sap.ui.getCore().byId(oRow.data("dateBoxId"));
        const oInvBox  = sap.ui.getCore().byId(oRow.data("invoiceBoxId"));

        oPHBox.setVisible(false);
        oDateBox.setVisible(sKey === "CREATION_DATE");
        oInvBox.setVisible(sKey === "INVOICE_NO");

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
    },

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
                return sap.ui.core.ValueState.Success;  // grün
            case "ccDS_UserAction":
                return sap.ui.core.ValueState.Warning;  // gelb/orange
            default:
                return sap.ui.core.ValueState.None;     // grau
        }
    },
//------------------------------------------------------------------------------------Filter-Button: Functionality------------------------------------------------------------
    onFilterDialogSave: function () {
        const oContainer  = sap.ui.core.Fragment.byId(this._sFilterFragmentId, "filtersContainer");
        const aRows       = oContainer.getItems();
        const oTokenizer  = this.byId("filterTokenizer");

        // alte Tokens löschen – wir bauen komplett neu
        oTokenizer.removeAllTokens();

        aRows.forEach(oRow => {
            const aItems    = oRow.getItems();
            const oLeftBox  = aItems[0];
            const oSelect   = oLeftBox.getItems()[1]; // [0] Label, [1] Select
            const sKey      = oSelect.getSelectedKey();

            if (!sKey) {
                return;
            }

            const oDateBox = sap.ui.getCore().byId(oRow.data("dateBoxId"));
            const oInvBox  = sap.ui.getCore().byId(oRow.data("invoiceBoxId"));

            // --- Invoice No. ---
            if (sKey === "INVOICE_NO") {
                const oInput = oInvBox.getItems()[1]; // [0] Label, [1] Input
                const sInv   = oInput.getValue().trim();
                if (!sInv) { return; }

                const oToken = new sap.m.Token({
                    text: "Invoice No. (" + sInv + ")",
                    key: "INVOICE_NO",
                    editable: true                    
                });
                oToken.setEditable(true);
                console.log(this.byId("filterTokenizer").getEditable());
                oToken.data("filterType", "INVOICE_NO");
                oToken.data("value", sInv);
                
                oTokenizer.addToken(oToken);
            }

            // --- Creation Date (DateRange) ---
            if (sKey === "CREATION_DATE") {
                const oDRS   = oDateBox.getItems()[1]; // [0] Label, [1] DateRangeSelection
                const dFrom  = oDRS.getDateValue();
                const dTo    = oDRS.getSecondDateValue() || dFrom;

                if (!dFrom || !dTo) { return; }

                const sLabel = "Creation Date (" + oDRS.getValue() + ")";

                const oToken = new sap.m.Token({
                    text: sLabel,
                    key: "CREATION_DATE",
                    editable: true
                });

                // WICHTIG: echte Dates speichern
                oToken.data("filterType", "CREATION_DATE");
                oToken.data("from", dFrom);
                oToken.data("to",   dTo);

                oTokenizer.addToken(oToken);
            }
    });

    // Filter aus Tokens anwenden
    this._applyFiltersFromTokens();

    this._oFilterDialog.close();
},

_applyFiltersFromTokens: function () {
    const oTokenizer = this.byId("filterTokenizer");
    const aTokens    = oTokenizer.getTokens();
    const oTable     = this.byId("tblBilling");
    const oBinding   = oTable.getBinding("items");

    if (!oBinding) { return; }

    const aFilters = [];

    aTokens.forEach(oToken => {
        const sType = oToken.data("filterType");

        // --- Invoice No. (wie bisher, passt) ---
        if (sType === "INVOICE_NO") {
            const sInv = oToken.data("value");
            if (sInv) {
                aFilters.push(new sap.ui.model.Filter(
                    "MetaData/Object/Data/Basics/Number/Value",
                    sap.ui.model.FilterOperator.Contains,
                    sInv
                ));
            }
        }

        // --- Creation Date: Custom-Filter mit Date-Vergleich ---
        if (sType === "CREATION_DATE") {
            const dFrom = oToken.data("from");
            const dTo   = oToken.data("to");

            if (dFrom && dTo) {
                aFilters.push(new sap.ui.model.Filter({
                    path: "History/Created/Date/$date",
                    test: function (v) {
                        // v = Wert aus JSON, z.B. "2025-11-10T12:34:56.000Z"
                        if (!v) { return false; }

                        const dVal = new Date(v);
                        // inklusiver Bereich
                        return dVal >= dFrom && dVal <= dTo;
                    }
                }));
            }
        }
    });

    oBinding.filter(aFilters);
    oTokenizer.setVisible(aTokens.length > 0);
},
    onFilterTokenChange: function (oEvent) {
        const sType      = oEvent.getParameter("type");   // z.B. "removed"
        const oToken     = oEvent.getParameter("token");
        const oTokenizer = oEvent.getSource();

        console.log("tokenChange:", sType, oToken && oToken.getText());

        // einzelne Tokens
        if (sType === "removed" && oToken) {
            oTokenizer.removeToken(oToken);
            this._applyFiltersFromTokens();
        }

        // alle gelöscht (Mülleimer-Icon / Clear)
        if (sType === "removedAll") {
            oTokenizer.removeAllTokens();
            this._applyFiltersFromTokens();
        }
    },



//--------------------------------------------------------------------------------------Settings-Button---------------------------------------------------------------------------------

    _createColumnSettingsPopover: function () {
    if (this._oColumnPopover) {
        return this._oColumnPopover;
    }

    const oTable = this.byId("tblBilling");
    const aColumns = oTable.getColumns();

    // Liste mit Checkboxen erzeugen
    const oList = new sap.m.List({
        items: aColumns.map(col => {
            const sColId = col.getId();
            const sColLabel = col.getHeader().getText();

            return new sap.m.CustomListItem({
                content: new sap.m.HBox({
                    items: [
                        new sap.m.CheckBox({
                            selected: true,
                            text: sColLabel,
                            select: (oEvent) => {
                                const bSelected = oEvent.getParameter("selected");
                                col.setVisible(bSelected);
                            }
                        }).addStyleClass("sapUiSmallMarginEnd")
                    ]
                })
            });
        })
    });

    this._oColumnPopover = new sap.m.Popover({
        placement: sap.m.PlacementType.Bottom,
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
//--------------------------------------------------------------------------------------Formatters for Table Data---------------------------------------------------------------------------------
        // --- Formatter für Type ccIT_* -> * ---
    formatInvoiceType: function (sType) {
      if (!sType) { return ""; }
      return sType.replace(/^ccIT_/, "");
    },
    
    // --- Formatter für Currency ccCS_* -> * ---
    formatCurrency: function (sCur) {
      if (!sCur) { return ""; }
      return sCur.replace(/^ccCS_/, "");
    },

    // --- Formatter für DeliveryMethod ccDM_* -> * ---
    formatDeliveryMethod: function (sMethod) {
      if (!sMethod) { return ""; }
      return sMethod.replace(/^ccDM_/, "");
    },

    // --- Datum aus $date in lesbares Datum konvertieren ---
    formatDate: function (sDate) {
      if (!sDate) { return ""; }
      try {
        const oDate = new Date(sDate);
        return oDate.toLocaleDateString(); // z.B. 28.11.2025
      } catch (e) {
        return sDate;
      }
    },

    // --- PDF-Spalte: aus TransferFormat Ja/Nein o. Ä. ableiten ---
    formatPdf: function (sTransferFormat) {
      if (!sTransferFormat) { return ""; }
      // Beispiel: wenn bestimmtes Format gesetzt ist -> "PDF"
      // hier kannst du deine Logik einbauen
      return sTransferFormat.indexOf("PDF") !== -1 ? "Ja" : "Nein";

    },
        formatCurrencyValue: function (vNumber) {
        // null/undefined abfangen
        if (vNumber == null) {
            return "";
        }

        // Locale-Objekt für Deutsch
        var oLocale = new Locale("de-DE");

        // Währungsformatter holen
        var oFormatter = NumberFormat.getCurrencyInstance({
            currencyCode: false,      // Symbol statt "EUR"
            showMeasure: true,        // € anzeigen
            maxFractionDigits: 2,
            minFractionDigits: 2
        }, oLocale);

        // Zahl formatieren – "EUR" liefert dann "€" im deutschen Locale
        return oFormatter.format(vNumber, "EUR");
    },

    });
});