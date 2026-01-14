sap.ui.define([], function () {
  "use strict";

  return {
    onIconTabSelect: function (oController, oEvent) {
      if (oEvent.getParameter("key") !== "history") {
        return;
      }

      const oHistory = oController.getView().getModel("history");
      const sDocId = oController._getCurrentDocumentId?.();

      if (!oHistory || !sDocId) {
        return;
      }

      const aLogs = oHistory.getProperty("/logs") || [];
      const sLastDocId = oHistory.getProperty("/lastDocId");

      // Wenn Logs fehlen oder DocId gewechselt hat → laden
      if (!aLogs.length || sLastDocId !== sDocId) {
        oHistory.setProperty("/lastDocId", sDocId);
        return this.loadHistoryLogs(oController);
      }
    },

    loadHistoryLogs: async function (oController) {
      const oHistory = oController.getView().getModel("history");
      const oAuth = oController.getOwnerComponent().getModel("auth");

      const sType = oAuth?.getProperty("/tokenType");
      const sTok  = oAuth?.getProperty("/token");
      const sDocId = oController._getCurrentDocumentId?.();

      if (!oHistory) { return; }

      if (!sDocId) {
        oHistory.setProperty("/logs", []);
        return;
      }

      if (!sTok) {
        oHistory.setProperty("/logs", [{
          message: "No auth token available.",
          date: new Date(),
          code: "",
          statusText: "Information",
          statusState: "Information"
        }]);
        return;
      }

      oHistory.setProperty("/busy", true);

      try {
        // API laut Beschreibung: .../documenthub/document(DocumentId)
        // Wir versuchen zuerst exakt diese Form, und fallback auf /document/<id>
        const sBase = "https://test.app.clarc.com:443/application/api/v1/documenthub";
        const sUrl1 = `${sBase}/document(${encodeURIComponent(sDocId)})`;
        const sUrl2 = `${sBase}/document/${encodeURIComponent(sDocId)}`;

        const oHeaders = {
          "Authorization": `${sType} ${sTok}`,
          "Accept": "application/json"
        };

        let oData;
        try {
          const r1 = await fetch(sUrl1, { method: "GET", headers: oHeaders });
          if (!r1.ok) throw new Error(`HTTP ${r1.status} ${r1.statusText}`);
          oData = await r1.json();
        } catch (e1) {
          const r2 = await fetch(sUrl2, { method: "GET", headers: oHeaders });
          if (!r2.ok) throw new Error(`HTTP ${r2.status} ${r2.statusText}`);
          oData = await r2.json();
        }

        const aChangeLog = Array.isArray(oData?.ChangeLog) ? oData.ChangeLog : [];
        const sDocState = oData?.State || "";

        // Mapping: ChangeLog[] -> List Items
        const aLogs = aChangeLog
          .map((x) => {
            const oDateRaw = x?.Date;
            const nMs = oDateRaw?.$date ?? oDateRaw; // unterstützt {$date: ...} oder direkt ms
            const d = nMs ? new Date(nMs) : new Date();

            const sMsg = x?.Text || "";
            const sCode = x?.Code || "";
            const sTypeLog = x?.Type || "";

            const oStatus = this.mapHistoryStatus(sDocState, sTypeLog, sCode, sMsg);

            return {
              message: this.buildHistoryMessage(x),
              date: d,
              code: sCode,
              statusText: oStatus.text,
              statusState: oStatus.state
            };
          })
          // neueste zuerst
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        oHistory.setProperty("/logs", aLogs);

      } catch (err) {
        oHistory.setProperty("/logs", [{
          message: `Failed to load history: ${err.message || err}`,
          date: new Date(),
          code: "",
          statusText: "Warning",
          statusState: "Warning"
        }]);
      } finally {
        oHistory.setProperty("/busy", false);
      }
    },

    buildHistoryMessage: function (x) {
      const sText = x?.Text || "";
      const sType = x?.Type || "";
      const sUser = x?.User || "";

      if (sText && sText.length > 0) {
        return sText;
      }
      return [sType, sUser].filter(Boolean).join(" - ");
    },

    mapHistoryStatus: function (sDocState, sLogType /* ccMT_* */, sCode, sMsg) {
      switch (sLogType) {
        case "ccMT_Success":
          return { text: "Success", state: "Success" };

        case "ccMT_Info":
          return { text: "Information", state: "Information" };

        case "ccMT_Warning":
          return { text: "Warning", state: "Warning" };

        case "ccMT_Error":
          return { text: "Error", state: "Error" };

        case "ccMT_Update":
          return { text: "Information", state: "Information" };

        default:
          return { text: "Information", state: "Information" };
      }
    },

    formatHistoryMeta: function (dDate, sCode) {
      if (!dDate) return sCode || "";

      const oFmt = sap.ui.core.format.DateFormat.getDateTimeInstance({
        pattern: "dd.MM.yy HH:mm:ss"
      });

      const sD = oFmt.format(dDate instanceof Date ? dDate : new Date(dDate));
      const sC = (sCode || "").trim();

      return sC ? `${sD} | ${sC}` : sD;
    }
  };
});
