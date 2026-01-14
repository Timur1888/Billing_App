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

      // Routing starten
      this.getRouter().initialize();

      // Daten im Hintergrund laden
      this._loadBackendData();

      const oAuthModel = new JSONModel({ tokenType: "", token: "" });
      this.setModel(oAuthModel, "auth");
    },

    // öffentliche Methode für Controller
    reloadBackendData: function () {
      return this._loadBackendData();
    },

    _loadBackendData: async function () {
    const loginUrl = "https://test.app.clarc.com/application/api/v1/iam/login";
    const dataUrl  = "https://test.app.clarc.com/application/api/v1/documenthub/document?$select=Id,History,Rights,State,MetaData.Object.Data.Basics.Recipient.Name,MetaData.Object.Data.Basics.Recipient.Email,MetaData.Object.Data.Basics.Number.Value,MetaData.Object.Data.Type,MetaData.Object.Data.SubType,MetaData.Object.Data.Amounts.Net.Value,MetaData.Object.Data.Amounts.Gross.Value,MetaData.Object.Data.Amounts.Currency.Value,MetaData.Object.Data.BusinessPartners,History.Created.Date,MetaData.Object.Data.Basics.Date.Value,MetaData.Object.Data.Basics.SendDate,MetaData.Object.Data.Basics.TransferFormat,MetaData.Object.Data.Basics.DeliveryMethod,MetaData.Object.Data.BusinessPartners,MetaData.Blobs,MetaData&$filter=(Process/Manager/Type%20eq%20%27ccPM_Billing%27)&$top=40&$orderby=CreationDate%20desc";


      // TODO: Diese Werte durch eure echten dev-Zugangsdaten ersetzen
      const oPayload = {
        Credentials: {
          Username:   "",
          Password:   "",
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

        // Falls ihr aus dem Login-Response einen Token braucht, hier auslesen:
        const loginData = await loginResp.json();

        // 2) Daten holen – entweder über Session-Cookie oder (optional) Token
        const response = await fetch(dataUrl, {
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

        this.getModel("auth").setData({
          tokenType: loginData?.Session?.TokenType || "",
          token:     loginData?.Session?.Token || ""
        });

        const json = await response.json();
        this.getModel("backend").setData(json);
      } catch (e) {
        console.error("Fehler beim Laden:", e);
      }
    }
  });
});
