sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  return UIComponent.extend("billing.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      // Backend-Model anlegen (damit Views darauf binden können)
      const oBackendModel = new JSONModel();
      this.setModel(oBackendModel, "backend");

      const oStatisticModel = new JSONModel();
      this.setModel(oStatisticModel, "statistic")

      const oAuthModel = new JSONModel({ tokenType: "", token: "" });
      this.setModel(oAuthModel, "auth");

      const oFilterModel = new JSONModel({
            /* ===== ValueHelps ===== */
            StatusList: [],
            RecipientNameList: [],
            SalesOrganisationList: [],
            InvoiceTypeList: [],
            SubTypeList: [],

            /* ===== User Values ===== */
            globalSearch: "",
            selectedStates: [],
            recipientName: "",
            nettoValue: "",
            invoiceNo: "",
            salesOrganisation: "",
            invoiceType: "",
            subType: "",
            factDateFrom: null,
                factDateTo: null
        });
        this.setModel(oFilterModel, "filterModel");

      // Routing starten
      this.getRouter().initialize();

      // Daten im Hintergrund laden
      this._loadBackendData();
      
    },

    // öffentliche Methode für Controller
    reloadBackendData: function () {
      return this._loadBackendData();
    },
    // MetaData/Object/Data/Type   MetaData/Object/Data/SubType   MetaData/Object/Data/BusinessPartners/0/SalesOrganisation/Value
    _loadBackendData: async function () {
    const loginUrl = "https://test.app.clarc.com/application/api/v1/iam/login";
    const statisticDataUrl  = "https://test.app.clarc.com/application/api/v1/documenthub/statistic";


      // TODO: Diese Werte durch eure echten dev-Zugangsdaten ersetzen
      const oPayload = {
        Credentials: {
          Username:   "Willi",
          Password:   "Ecmdemo2025!",
          Tenant:     "acme",
          SystemClass:"ccSC_Development",
          Language:   "DE",
          FingerPrint:"none",
          Code:       "",
          Token: {
            Data: "",
            Type: "ccVT_Unknown"
          },
          RequiredRoles: [],
          ClientId:      "",
          ClientSecret:  ""
        }
      };

      try {
        // 1) Login-Request
        const loginResp = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          // ganz wichtig, damit evtl. gesetzte Cookies für den nächsten Call mitgeschickt werden
          credentials: "include",
          body: JSON.stringify(oPayload)
        });

        if (!loginResp.ok) {
          console.error("Login-Fehler:", loginResp.status, loginResp.statusText);
          return;
        }

        const loginData = await loginResp.json();
        this.getModel("auth").setData({
          tokenType: loginData?.Session?.TokenType || "",
          token:     loginData?.Session?.Token || ""
        });

        // 2) Daten holen – entweder über Session-Cookie oder (optional) Token
        const response = await fetch(statisticDataUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            "Authorization": loginData.Session.TokenType + " " + loginData.Session.Token 
          },
        });

        if (!response.ok) {
          console.error("Backend Request Error:", response.status, response.statusText);
          return;
        }

        const json = await response.json();
        this.getModel("statistic").setData(json);
        this._rebuildFilter();
      } catch (e) {
        console.error("Fehler beim Laden:", e);
      }
      //-----------------------------------------------------------------------------------------------------------------------------------
  },
      //baut das Modell filterModel aus, das Modell wird für Filtering eingesetzt
    _rebuildFilter: function() {
      var oStatistics = this.getModel("statistic");
      var oFb = this.getModel("filterModel");
      if (!oStatistics || !oFb) {
        return;
      }

      var aRows = oStatistics.getProperty("/States") || [];

      var mStates = Object.create(null);
      // var mSalesOrg = Object.create(null);
      // var mInvType = Object.create(null);
      // var msubType = Object.create(null);

      aRows.forEach(function(r) {
        // State
        var sState = r && r.State;
        if (sState) {
          mStates[sState] = true;
        }
        // // Sales Organisation 
        // var sSalesOrg = r?.MetaData?.Object?.Data?.BusinessPartners?.[0]?.SalesOrganisation?.Value || "";
        // if (sSalesOrg) {
        //   mSalesOrg[sSalesOrg] = true;
        // }

        // // Invoice Type
        // var sInvType = r?.MetaData?.Object?.Data?.Type || "";
        // if (sInvType) {
        //   mInvType[sInvType] = true;
        // }
        
        // // Sub Type
        // var sSubType = r?.MetaData?.Object?.Data?.SubType || "";
        // if (sSubType) {
        //   msubType[sSubType] = true;
        // }
       
      });

      oFb.setProperty("/StatusList",
        Object.keys(mStates).sort().map(function(s) {
          return { key: s, text: s };
        })
      );

      // oFb.setProperty("/SalesOrganisationList",
      //   Object.keys(mSalesOrg).sort().map(function(s) {
      //     return { key: s, text: s };
      //   })
      // );

      // oFb.setProperty("/InvoiceTypeList",
      //   Object.keys(mInvType).sort().map(function(s) {
      //     return { key: s, text: s };
      //   })
      // );

      // oFb.setProperty("/SubTypeList",
      //   Object.keys(msubType).sort().map(function(s) {
      //     return { key: s, text: s };
      //   })
      // );
    },
  });
});
