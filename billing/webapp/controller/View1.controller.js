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
        onSearchLive() {},      
        onFilter() {},          
        onSettings() {},
        onInvoicePress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");

            // 🔴 WICHTIG: Kontext des Models "testData" holen
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