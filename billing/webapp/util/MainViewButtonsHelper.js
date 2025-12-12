sap.ui.define([
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (MessageBox, Filter, FilterOperator) {
  "use strict";

  return {
    // ---------------------------------------------------
    // Refreschen
    // ---------------------------------------------------
    onReload: async function (oController) {
      const oComponent = oController.getOwnerComponent();
      const oTable     = oController.byId("tblBilling");

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

      const oDeleteButton = oController.byId("btnDelete");
      if (oDeleteButton) {
        oDeleteButton.setEnabled(false);
      }

      const oTokenizer = oController.byId("filterTokenizer");
      if (oTokenizer) {
        oTokenizer.removeAllTokens();
        oTokenizer.setVisible(false);
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

    // ---------------------------------------------------
    // Suche
    // ---------------------------------------------------
    onSearch: function (oController, oEvent) {
      const sQuery = oEvent.getParameter("query")?.trim().toLowerCase();
      const oTable = oController.byId("tblBilling");
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

      // Optionaler “no results” Guard wie bei dir:
      const aData = oController.getOwnerComponent()
        .getModel("backend")
        .getProperty("/value") || [];

      const aMatches = aData.filter(item => {
        const invoice = String(item.MetaData?.Object?.Data?.Basics?.Number?.Value || "").toLowerCase();
        const name    = String(item.MetaData?.Object?.Data?.Basics?.Recipient?.Name || "").toLowerCase();
        const email   = String(item.MetaData?.Object?.Data?.Basics?.Recipient?.Email?.[0]?.Address || "").toLowerCase();

        return invoice.includes(sQuery) || name.includes(sQuery) || email.includes(sQuery);
      });

      if (aMatches.length === 0) {
        return;
      }

      oBinding.filter(oCombinedFilter);
    }
  };
});
