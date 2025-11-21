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

      // Backend-Model anlegen (erst mal leer)
      const oBackendModel = new JSONModel();
      this.setModel(oBackendModel, "backend");

      // Routing direkt starten
      this.getRouter().initialize();

      // Daten im Hintergrund laden (kein await)
      this._loadBackendData();
    },

    _loadBackendData: async function () {
      const tokenUrl = "https://test.app.clarc.com/application/api/v1/iam/oauth/token";
      const clientId = "36c323c6a3e36b22280897729a32d85c4b38bde2766d7b0f89aa4632b91a2252";
      const clientSecret = "bb1a956012ac59886de22a089ee90637118861c1bece1157d70e91112a6ba62f";
      //https://test.app.clarc.com:443/application/api/v1/documenthub/document?$filter=Process/Manager/Type eq 'ccPM_Billing'
      //https://test.app.clarc.com/application/api/v1/documenthub/document?$select=Id,History,Rights,State,MetaData.Object.Data.Basics.Recipient.Name,MetaData.Object.Data.Basics.Recipient.Email,MetaData.Object.Data.Basics.Number.Value,MetaData.Object.Data.Type,MetaData.Object.Data.SubType,MetaData.Object.Data.Amounts.Net.Value,MetaData.Object.Data.Amounts.Gross.Value,MetaData.Object.Data.Amounts.Currency.Value,MetaData.Object.Data.BusinessPartners,History.Created.Date,MetaData.Object.Data.Basics.Date.Value,MetaData.Object.Data.Basics.SendDate,MetaData.Object.Data.Basics.TransferFormat,MetaData.Object.Data.Basics.DeliveryMethod,MetaData.Object.Data.BusinessPartners,MetaData.Blobs,MetaData&$filter=(Process/Manager/Type%20eq%20%27ccPM_Billing%27)&$top=40&$orderby=CreationDate%20desc
      const dataUrl = "https://test.app.clarc.com:443/application/api/v1/documenthub/$metadata";

      try {
        const url = `${tokenUrl}?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
        const tokenResp = await fetch(url);
        if (!tokenResp.ok) {
          console.error("Token-Fehler:", tokenResp.status);
          return;
        }
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;

        const response = await fetch(dataUrl, {
          method: "GET",
          headers: { "Authorization": "Bearer " + accessToken }
        });

        if (!response.ok) {
          console.error("Backend Request Error:", response.status);
          return;
        }

        const json = await response.json();
        this.getModel("backend").setData(json); // Views aktualisieren sich automatisch
      } catch (e) {
        console.error("Fehler beim Laden:", e);
      }
    }
  });
});
