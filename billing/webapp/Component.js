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
    },

    // öffentliche Methode für Controller
    reloadBackendData: function () {
      return this._loadBackendData();
    },

    _loadBackendData: async function () {
    const loginUrl = "";
    const dataUrl  = "";


      // TODO: Diese Werte durch eure echten dev-Zugangsdaten ersetzen
      const oPayload = {
        Credentials: {
          Username:   "",
          
          Password:   "",

          Tenant:     "",
          SystemClass:"",
          Language:   "",
          FingerPrint:"",
          Code:       "",
          Token: {
            Data: "",
            Type: ""
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

        const json = await response.json();
        this.getModel("backend").setData(json);
      } catch (e) {
        console.error("Fehler beim Laden:", e);
      }
    }
  });
});
