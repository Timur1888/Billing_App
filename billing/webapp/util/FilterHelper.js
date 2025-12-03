sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Fragment, Filter, FilterOperator) {
    "use strict";

    function _getContainer(oController) {
        return Fragment.byId(oController._sFilterFragmentId, "filtersContainer");
    }

    function _updateDeleteButtons(oController) {
        const oContainer = _getContainer(oController);
        const aRows = oContainer.getItems();
        const iLastIndex = aRows.length - 1;

        aRows.forEach(function (oRow, iIndex) {
            const aItems = oRow.getItems();
            const oBtn = aItems[aItems.length - 1]; // letztes Item = X-Button

            if (oBtn && oBtn instanceof sap.m.Button) {
                oBtn.setEnabled(iIndex !== iLastIndex);
            }
        });
    }

    function _addEmptyFilterRow(oController) {
        const oContainer = _getContainer(oController);

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
            selectedKey: "",
            forceSelection: false,
            change: oController.onFilterFieldChange.bind(oController)
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

        // ===== Mitte: Placeholder / DateRange / Invoice ====
        const oRightBox = new sap.m.VBox({ width: "45%" });

        // Placeholder
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

        // ===== rechts: Delete-Button =====
        const oDeleteBtn = new sap.m.Button({
            icon: "sap-icon://decline",
            type: "Transparent",
            tooltip: "Remove filter",
            press: oController.onFilterRowDelete.bind(oController)
        });

        // IDs am Row speichern
        oRow.data("placeholderBoxId", oPlaceholderBox.getId());
        oRow.data("dateBoxId", oDateBox.getId());
        oRow.data("invoiceBoxId", oInvoiceBox.getId());

        oRow.addItem(oLeftBox);
        oRow.addItem(oRightBox);
        oRow.addItem(oDeleteBtn);

        oContainer.addItem(oRow);
        _updateDeleteButtons(oController);
    }

    function _initFilterRows(oController) {
        const oContainer = _getContainer(oController);
        oContainer.removeAllItems();
        _addEmptyFilterRow(oController);
    }

    function _applyFiltersFromTokens(oController) {
        const oTokenizer = oController.byId("filterTokenizer");
        const aTokens    = oTokenizer.getTokens();
        const oTable     = oController.byId("tblBilling");
        const oBinding   = oTable.getBinding("items");

        if (!oBinding) { return; }

        const aFilters = [];

        aTokens.forEach(oToken => {
            const sType = oToken.data("filterType");

            // Invoice No.
            if (sType === "INVOICE_NO") {
                const sInv = oToken.data("value");
                if (sInv) {
                    aFilters.push(new Filter(
                        "MetaData/Object/Data/Basics/Number/Value",
                        FilterOperator.Contains,
                        sInv
                    ));
                }
            }

            // Creation Date
            if (sType === "CREATION_DATE") {
                const dFrom = oToken.data("from");
                const dTo   = oToken.data("to");

                if (dFrom && dTo) {
                    aFilters.push(new Filter({
                        path: "History/Created/Date/$date",
                        test: function (v) {
                            if (!v) { return false; }
                            const dVal = new Date(v);
                            return dVal >= dFrom && dVal <= dTo;
                        }
                    }));
                }
            }
        });

        oBinding.filter(aFilters);
        oTokenizer.setVisible(aTokens.length > 0);
    }

    return {
        createFilterPopover: function (oController) {
            if (!oController._oFilterPopover) {

                const oList = new sap.m.List({
                    items: [
                        new sap.m.StandardListItem({
                            title: "Add Filter",
                            type: "Navigation",
                            icon: "sap-icon://add",
                            press: oController.onAddFilterPress.bind(oController)
                        })
                    ]
                });

                oList.addStyleClass("filterPopoverList");

                oController._oFilterPopover = new sap.m.Popover({
                    placement: sap.m.PlacementType.Bottom,
                    showHeader: false,
                    contentWidth: "200px",
                    content: [oList]
                });

                oController.getView().addDependent(oController._oFilterPopover);
            }

            return oController._oFilterPopover;
        },

        openFilterDialog: function (oController) {
            if (!oController._oFilterDialog) {
                oController._sFilterFragmentId = "filterDialogFragment";

                oController._oFilterDialog = Fragment.load({
                    id: oController._sFilterFragmentId,
                    name: "billing.view.FilterDialog",
                    controller: oController
                }).then(function (oDialog) {
                    oController._oFilterDialog = oDialog;
                    oController.getView().addDependent(oDialog);
                    _initFilterRows(oController);
                    oDialog.open();
                });

                return;
            }

            _initFilterRows(oController);
            oController._oFilterDialog.open();
        },

        onFilterFieldChange: function (oController, oEvent) {
            const sKey   = oEvent.getSource().getSelectedKey();
            const oRow   = oEvent.getSource().getParent().getParent(); // Select -> VBox -> HBox

            const oPHBox   = sap.ui.getCore().byId(oRow.data("placeholderBoxId"));
            const oDateBox = sap.ui.getCore().byId(oRow.data("dateBoxId"));
            const oInvBox  = sap.ui.getCore().byId(oRow.data("invoiceBoxId"));

            oPHBox.setVisible(false);
            oDateBox.setVisible(sKey === "CREATION_DATE");
            oInvBox.setVisible(sKey === "INVOICE_NO");

            if (sKey) {
                const oContainer = _getContainer(oController);
                const aRows = oContainer.getItems();
                const bIsLastRow = aRows[aRows.length - 1] === oRow;

                if (bIsLastRow) {
                    _addEmptyFilterRow(oController);
                }
            }
        },

        onFilterRowDelete: function (oController, oEvent) {
            const oBtn = oEvent.getSource();
            const oRow = oBtn.getParent();
            const oContainer = _getContainer(oController);
            const aRows = oContainer.getItems();

            const iIndex = aRows.indexOf(oRow);
            const iLastIndex = aRows.length - 1;

            if (iIndex === iLastIndex) {
                return;
            }

            oContainer.removeItem(oRow);
            oRow.destroy();

            _updateDeleteButtons(oController);
        },

        onFilterDialogSave: function (oController) {
            const oContainer  = _getContainer(oController);
            const aRows       = oContainer.getItems();
            const oTokenizer  = oController.byId("filterTokenizer");

            oTokenizer.removeAllTokens();

            aRows.forEach(oRow => {
                const aItems    = oRow.getItems();
                const oLeftBox  = aItems[0];
                const oSelect   = oLeftBox.getItems()[1];
                const sKey      = oSelect.getSelectedKey();

                if (!sKey) {
                    return;
                }

                const oDateBox = sap.ui.getCore().byId(oRow.data("dateBoxId"));
                const oInvBox  = sap.ui.getCore().byId(oRow.data("invoiceBoxId"));

                if (sKey === "INVOICE_NO") {
                    const oInput = oInvBox.getItems()[1];
                    const sInv   = oInput.getValue().trim();
                    if (!sInv) { return; }

                    const oToken = new sap.m.Token({
                        text: "Invoice No. (" + sInv + ")",
                        key: "INVOICE_NO",
                        editable: true
                    });
                    oToken.data("filterType", "INVOICE_NO");
                    oToken.data("value", sInv);

                    oTokenizer.addToken(oToken);
                }

                if (sKey === "CREATION_DATE") {
                    const oDRS   = oDateBox.getItems()[1];
                    const dFrom  = oDRS.getDateValue();
                    const dTo    = oDRS.getSecondDateValue() || dFrom;

                    if (!dFrom || !dTo) { return; }

                    const sLabel = "Creation Date (" + oDRS.getValue() + ")";
                    const oToken = new sap.m.Token({
                        text: sLabel,
                        key: "CREATION_DATE",
                        editable: true
                    });

                    oToken.data("filterType", "CREATION_DATE");
                    oToken.data("from", dFrom);
                    oToken.data("to",   dTo);

                    oTokenizer.addToken(oToken);
                }
            });

            _applyFiltersFromTokens(oController);
            oController._oFilterDialog.close();
        },

        applyFiltersFromTokens: _applyFiltersFromTokens,

        onFilterTokenChange: function (oController, oEvent) {
            const sType      = oEvent.getParameter("type");
            const oToken     = oEvent.getParameter("token");
            const oTokenizer = oEvent.getSource();

            if (sType === "removed" && oToken) {
                oTokenizer.removeToken(oToken);
                _applyFiltersFromTokens(oController);
            }

            if (sType === "removedAll") {
                oTokenizer.removeAllTokens();
                _applyFiltersFromTokens(oController);
            }
        }
    };
});
