sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "billing/util/FilterHelper",
    "sap/ui/thirdparty/jquery"          // <--- NEU
], function (JSONModel, Filter, FilterOperator, MessageToast, FilterHelper, jQuery) {
    "use strict";

    const MAX_LEN = 36;

    const ViewsHelper = {

        // =====================================================
        // Init
        // =====================================================
        initVariantModel: function (oController) {
            const oDefaultState = this.getCurrentState(oController);

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

            oController.getView().setModel(oVariantModel, "variant");
        },

        // =====================================================
        // Helper
        // =====================================================
        ensureAtLeastOneView: function (oController) {
            const oModel = oController.getView().getModel("variant");
            if (!oModel) { return; }

            const oData = oModel.getData() || {};
            oData.views = Array.isArray(oData.views) ? oData.views : [];

            if (oData.views.length === 0) {
                const oState = this.getCurrentState(oController);
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
                this.applyState(oController, oState);
            }
        },

        getCurrentState: function (oController) {
            const oTokenizer = oController.byId("filterTokenizer");
            const oTable     = oController.byId("tblBilling");

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

            let aColumnsState = [];
            if (oTable) {
                aColumnsState = oTable.getColumns().map(function (oCol) {
                    return {
                        id: oCol.getId(),
                        visible: oCol.getVisible()
                    };
                });
            }

            return {
                tokens:  aTokensState,
                sorters: [],
                columns: aColumnsState
            };
        },

        applyState: function (oController, oState) {
            const oTokenizer = oController.byId("filterTokenizer");
            const oTable     = oController.byId("tblBilling");

            // Tokens / Filter
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

                FilterHelper.applyFiltersFromTokens(oController);
            }

            // Spalten
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

            if (oController._oColumnPopover) {
                oController._oColumnPopover.destroy();
                oController._oColumnPopover = null;
            }
        },

        // =====================================================
        // Variant Popover
        // =====================================================
        openVariantPopover: function (oController, oEvent) {
            this.ensureAtLeastOneView(oController);

            if (!oController._oVariantPopover) {
                oController._oVariantPopover = sap.ui.xmlfragment(
                    "billing.view.VariantPopover",
                    oController
                );
                oController.getView().addDependent(oController._oVariantPopover);
            }
            oController._oVariantPopover.openBy(oEvent.getSource());
        },

        variantSelected: function (oController, oEvent) {
            const oCtx  = oEvent.getParameter("listItem").getBindingContext("variant");
            const sId   = oCtx.getProperty("id");
            const oView = oCtx.getObject();

            const oVariantModel = oController.getView().getModel("variant");
            oVariantModel.setProperty("/currentViewId",   sId);
            oVariantModel.setProperty("/currentViewName", oView.name);

            this.applyState(oController, oView.state || {});
        },

        // =====================================================
        // Manage Dialog
        // =====================================================
        openManageDialog: function (oController) {
            this.ensureAtLeastOneView(oController);

            const oVariantModel = oController.getView().getModel("variant");
            const aViews        = oVariantModel.getProperty("/views") || [];

            // Tiefen-Kopie, die Date-Objekte erhält
            const aCopy = jQuery.extend(true, [], aViews);

            if (!oController._oManageModel) {
                oController._oManageModel = new JSONModel();
            }
            oController._oManageModel.setData({ views: aCopy });

            if (!oController._oManageDialog) {
                oController._oManageDialog = sap.ui.xmlfragment(
                    "billing.view.ManageVariants",
                    oController
                );
                oController.getView().addDependent(oController._oManageDialog);
            }

            oController._oManageDialog.setModel(oController._oManageModel, "variantManage");
            oController._oManageDialog.open();
        },

        closeManageDialog: function (oController) {
            if (oController._oManageDialog) {
                oController._oManageDialog.close();
            }
        },

        variantDelete: function (oController, oEvent) {
            const oCtx         = oEvent.getSource().getBindingContext("variantManage");
            const bIsDefault   = oCtx.getProperty("isDefault");
            const oManageModel = oController._oManageModel;
            let   aViews       = oManageModel.getProperty("/views") || [];

            if (bIsDefault) {
                MessageToast.show("Die Standardansicht kann nicht gelöscht werden.");
                return;
            }

            if (aViews.length <= 1) {
                MessageToast.show("Es muss mindestens eine Ansicht vorhanden sein.");
                return;
            }

            const sPath  = oCtx.getPath();
            const sIndex = sPath.split("/").pop();
            const iIndex = parseInt(sIndex, 10);

            if (!isNaN(iIndex) && iIndex >= 0 && iIndex < aViews.length) {
                aViews.splice(iIndex, 1);
                oManageModel.setProperty("/views", aViews);
            }
        },

        variantDefaultToggle: function (oController, oEvent) {
            const oCtx         = oEvent.getSource().getBindingContext("variantManage");
            const sId          = oCtx.getProperty("id");
            const oManageModel = oController._oManageModel;
            const aViews       = oManageModel.getProperty("/views") || [];

            aViews.forEach(function (v) {
                v.isDefault = (v.id === sId);
            });

            oManageModel.setProperty("/views", aViews);
        },

        manageSearch: function (oController, oEvent) {
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

        manageSave: function (oController) {
            const oVariantModel = oController.getView().getModel("variant");
            const oManageModel  = oController._oManageModel;

            const aViews = oManageModel.getProperty("/views") || [];

            if (!aViews.length) {
                MessageToast.show("Es muss mindestens eine Ansicht vorhanden sein.");
                return;
            }

            let oDefault = aViews.find(function (v) { return v.isDefault; });
            if (!oDefault) {
                oDefault = aViews[0];
                aViews.forEach(function (v) { v.isDefault = (v === oDefault); });
            }

            oVariantModel.setProperty("/views", aViews);
            oVariantModel.setProperty("/currentViewId",   oDefault.id);
            oVariantModel.setProperty("/currentViewName", oDefault.name);

            this.applyState(oController, oDefault.state || {});

            if (oController._oManageDialog) {
                oController._oManageDialog.close();
            }
        },

        // =====================================================
        // Save View Dialog
        // =====================================================
        saveViewAs: function (oController) {
            const oModel = oController.getView().getModel("variant");

            oModel.setProperty("/newView", {
                name: "",
                isDefault: false,
                isPivate: false,
                autoApply: false
            });

            if (!oController._oSaveViewDialog) {
                oController._oSaveViewDialog = sap.ui.xmlfragment(
                    "billing.view.SaveViewDialog",
                    oController
                );
                oController.getView().addDependent(oController._oSaveViewDialog);
            }
            oController._oSaveViewDialog.open();
        },

        cancelSaveView: function (oController) {
            if (oController._oSaveViewDialog) {
                oController._oSaveViewDialog.close();
            }
        },

        confirmSaveView: function (oController) {
            const oModel   = oController.getView().getModel("variant");
            const oData    = oModel.getData();
            const oNewView = oData.newView;
            const oInput   = sap.ui.getCore().byId("inpViewName");

            let sName = (oNewView.name || "").trim();

            if (!sName) {
                if (oInput) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Bitte einen Namen eingeben");
                }
                MessageToast.show("Bitte einen Namen eingeben");
                return;
            }

            if (sName.length > MAX_LEN) {
                sName = sName.substring(0, MAX_LEN);
                oNewView.name = sName;
                if (oInput) {
                    oInput.setValue(sName);
                }
            }

            const aViews = oData.views || [];
            const bExists = aViews.some(function (v) {
                return (v.name || "").trim().toLowerCase() === sName.toLowerCase();
            });

            if (bExists) {
                if (oInput) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Eine Ansicht mit diesem Namen existiert bereits");
                }
                MessageToast.show("Eine Ansicht mit diesem Namen existiert bereits");
                return;
            }

            if (oInput) {
                oInput.setValueState("None");
                oInput.setValueStateText("");
            }

            const oState = this.getCurrentState(oController);

            const sId = "V" + (aViews.length + 1);

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

            if (oNewView.isDefault) {
                oData.views.forEach(function (v) {
                    v.isDefault = (v.id === sId);
                });
            }

            oModel.refresh(true);

            if (oController._oSaveViewDialog) {
                oController._oSaveViewDialog.close();
            }
            if (oController._oVariantDialog) {
                oController._oVariantDialog.close();
            }

            MessageToast.show("Ansicht gespeichert: " + oView.name);
        },

        // optional, falls irgendwo noch verwendet
        closeVariantDialog: function (oController) {
            if (oController._oVariantDialog) {
                oController._oVariantDialog.close();
            }
        }
    };

    return ViewsHelper;
});
