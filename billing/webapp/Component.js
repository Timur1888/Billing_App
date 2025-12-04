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

    _loadBackendData: async function () {
    const loginUrl = "https://test.app.clarc.com/application/api/v1/iam/login";
    const dataUrl  = "https://test.app.clarc.com/application/api/v1/documenthub/document?$filter=Process/Manager/Type eq 'ccPM_Billing'";


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

        // Falls ihr aus dem Login-Response einen Token braucht, hier auslesen:
        const loginData = await loginResp.json();
        // Beispiel – bitte an eure echte Struktur anpassen:
        // const sToken = loginData.Token && loginData.Token.Data;

        // 2) Daten holen – entweder über Session-Cookie oder (optional) Token
        const response = await fetch(dataUrl, {
          method: "GET",
          credentials: "include" // sendet das gleiche Cookie wie beim Login mit
          // Falls ihr doch einen Token-Header braucht, dann z.B.:
          // headers: {
          //   "Authorization": "Bearer " + sToken
          // },
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
