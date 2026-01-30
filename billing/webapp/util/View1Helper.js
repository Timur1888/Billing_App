sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/Token",
  "sap/ui/model/Sorter",
  "sap/m/table/columnmenu/QuickSortItem"
], function (
  Fragment,
  Filter,
  FilterOperator,
  Token,
  Sorter,
  QuickSortItem
) {
  "use strict";

  return {

    //macht Fragment für die Sortierung einzelner Spalten generisch
    _attachPerColumnMenus: function() {
      const oView = this.getView();
      const oTable = this.byId("tblBilling");

      const aPromises = oTable.getColumns().map((oCol) => {
        const sSortKey = (oCol.data("sortKey") || "").trim();
        if (!sSortKey) {
          return Promise.resolve();
        }

        return Fragment.load({
          id: oView.getId() + "--" + oCol.getId(), // unique prefix pro Column
          name: "billing.view.fragments.ColumnMenu",
          controller: this
        }).then((oMenu) => {
          oView.addDependent(oMenu);
          this._aColumnMenus.push(oMenu);

          // QuickSort finden (UI5-versionssicher)
          let oQuickSort = null;

          if (oMenu.getItems) {
            oQuickSort = oMenu.getItems().find(i => i.isA && i.isA("sap.m.table.columnmenu.QuickSort"));
          }

          // Fallback: tief suchen
          if (!oQuickSort && oMenu.findAggregatedObjects) {
            const aFound = oMenu.findAggregatedObjects(true, (oObj) =>
              oObj.isA && oObj.isA("sap.m.table.columnmenu.QuickSort")
            );
            oQuickSort = aFound && aFound[0];
          }

          if (!oQuickSort) {
            console.error("QuickSort NOT found. Menu items are:", (oMenu.getItems ? oMenu.getItems().map(x => x.getMetadata().getName()) : []));
            return;
          }

          // Items setzen: nur diese Spalte
          oQuickSort.removeAllItems();

          const oHeader = oCol.getHeader();
          const sLabel = (oHeader && oHeader.getText) ? oHeader.getText() : sSortKey;

          oQuickSort.addItem(new QuickSortItem({
            key: sSortKey,
            label: sLabel
          }));

          // Menu nur an diese Column hängen
          oCol.setHeaderMenu(oMenu);
        });
      });

      return Promise.all(aPromises);
    },

    //baut das Modell filterModel aus, das Modell wird für Filtering eingesetzt
    _rebuildValueHelps: function() {
      var oBackend = this.getView().getModel("backend");
      var oFb = this.getView().getModel("filterModel");
      if (!oBackend || !oFb) {
        return;
      }

      var aRows = oBackend.getProperty("/value") || [];

      var mStates = Object.create(null);
      var mNames = Object.create(null);
      var mInv = Object.create(null); // key = InvoiceNo, value = {InvoiceNo, RecipientName}
      var mNet = Object.create(null);

      aRows.forEach(function(r) {
        // State
        var sState = r && r.State;
        if (sState) {
          mStates[sState] = true;
        }
        // Recipient Name
        var sName = r?.MetaData?.Object?.Data?.Basics?.Recipient?.Name || "";
        if (sName) {
          mNames[sName] = true;
        }
        // Invoice No.
        var sInv = r?.MetaData?.Object?.Data?.Basics?.Number?.Value;
        if (sInv != null && sInv !== "") {
          var sInvStr = "" + sInv;
          if (!mInv[sInvStr]) {
            mInv[sInvStr] = {
              InvoiceNo: sInvStr,
              RecipientName: sName
            };
          }
        }
        // Net Amount
        var vNet = r?.MetaData?.Object?.Data?.Amounts?.Net?.Value;
        if (vNet != null && vNet !== "") {
          var sNet = "" + vNet;
          mNet[sNet] = true;
        }
      });

      oFb.setProperty("/StatusList",
        Object.keys(mStates).sort().map(function(s) {
          return { key: s, text: s };
        })
      );

      oFb.setProperty("/RecipientNameList",
        Object.keys(mNames).sort().map(function(s) {
          return { key: s, text: s };
        })
      );

      oFb.setProperty("/InvoiceNumberList",
        Object.keys(mInv).sort().map(function(k) {
          return mInv[k];
        })
      );

      oFb.setProperty("/NettoValueList",
        Object.keys(mNet).sort().map(function(s) {
          return { key: s, text: s };
        })
      );
    },

    //Ermöglicht die Suche mit *
    _buildWildcardSearchFilter: function(sQuery, aPaths) {
      if (!sQuery) {
        return null;
      }

      var s = (sQuery || "").trim();
      if (!s) {
        return null;
      }

      // entferne Rand-* und ignoriere Query nur aus Sternen
      var sCore = s.replace(/^\*+/, "").replace(/\*+$/, "");
      if (!sCore) {
        return null;
      }

      // ROBUST: immer Contains, damit JSONModel + Nested Paths sicher matchen
      var op = FilterOperator.Contains;

      return new Filter({
        filters: aPaths.map(function(sPath) {
          return new Filter(sPath, op, sCore);
        }),
        and: false
      });
    },

    //verwandelt die explizite Eingabe (Text) im MultiInput in Tokens
    _finalizeMultiInputTokens: function() {
      var oMI = this._oMultiInput || this.byId("multiInput");
      if (!oMI) {
        return;
      }

      var sText = (oMI.getValue && oMI.getValue() || "").trim();
      if (!sText) {
        return;
      }

      // mehrere Eingaben per Komma erlauben
      var aParts = sText.split(",").map(function(x) {
        return x.trim();
      }).filter(Boolean);

      // vorhandene Token-Keys
      var mExisting = Object.create(null);
      (oMI.getTokens() || []).forEach(function(t) {
        var k = t && t.getKey ? (t.getKey() || "").trim() : "";
        if (k) {
          mExisting[k] = true;
        }
      });

      // Quelle: ValueHelp-Liste
      var oFb = this.getView().getModel("filterModel");
      var aInvList = (oFb && oFb.getProperty("/InvoiceNumberList")) || []; // [{InvoiceNo, RecipientName}, ...]

      // helper: "*9*" -> "9"
      var fnCore = function(s) {
        s = (s || "").trim();
        if (!s) {
          return "";
        }
        var sCore = s.replace(/^\*+/, "").replace(/\*+$/, "");
        return (sCore || "").trim();
      };

      // helper: findet InvoiceNos, die core enthalten (case-insensitive)
      var fnFindMatches = function(sPart) {
        var sCore = fnCore(sPart);
        if (!sCore) {
          return [];
        }

        var sNeedle = sCore.toLowerCase();
        return aInvList
          .map(function(x) {
            return x && x.InvoiceNo != null ? String(x.InvoiceNo) : "";
          })
          .filter(Boolean)
          .filter(function(sInv) {
            return sInv.toLowerCase().indexOf(sNeedle) > -1;
          });
      };

      aParts.forEach(function(sPart) {
        // Wenn * enthalten oder du generell Pattern zulassen willst:
        var aMatches = fnFindMatches(sPart);

        if (aMatches.length > 0) {
          aMatches.forEach(function(sInv) {
            if (mExisting[sInv]) {
              return;
            }
            oMI.addToken(new Token({
              key: sInv,
              text: sInv
            }));
            mExisting[sInv] = true;
          });
          return;
        }

        // Keine Treffer -> als "hartes" Token hinzufügen,
        // damit der Tabellenfilter später 0 Treffer ergibt (Tabelle leer)
        var sFallback = sPart;
        if (!mExisting[sFallback]) {
          oMI.addToken(new Token({
            key: sFallback,
            text: sFallback
          }));
          mExisting[sFallback] = true;
        }
      });

      // Textfeld leeren
      oMI.setValue("");
    },

    //Helper für Datumvalidierung
    _validateDateDDMMYYYY: function(s) {
      // erwartet "dd.MM.yyyy"
      var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s || "");
      if (!m) {
        return { ok: false };
      }

      var d = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10);
      var y = parseInt(m[3], 10);

      var yNow = new Date().getFullYear();

      if (mo < 1 || mo > 12) { return { ok: false, msg: "Month must be between 01 and 12." }; }
      if (y > yNow) { return { ok: false, msg: "Year must not be greater than " + yNow + "." }; }
      if (d < 1 || d > 31) { return { ok: false, msg: "Day must be between 01 and 31." }; }

      // echte Datumskonsistenz (z.B. 31.02) prüfen
      var dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) {
        return { ok: false, msg: "Invalid calendar date." };
      }

      return { ok: true, date: dt };
    },

    //Popup schliessen
    _closeDRSPopup: function(oDRS) {
      var oPopup = oDRS && oDRS.getAggregation && oDRS.getAggregation("_popup");
      if (oPopup && oPopup.isOpen && oPopup.isOpen()) {
        oPopup.close();
      }
    },

    // @endregion
_onMultiInputValidate: function(oArgs) {
  if (oArgs.suggestionObject) {
    var o = oArgs.suggestionObject.getBindingContext("filterModel").getObject();
    return new Token({
      key: o.InvoiceNo,
      text: o.InvoiceNo + " (" + o.RecipientName + ")"
    });
  }
  return null;
},

//Filtriert interne Tabelle
_filterTable: function(oFilter) {
  var oVHD = this._oVHD;

  oVHD.getTableAsync().then(function(oTable) {
    if (oTable.bindRows) {
      oTable.getBinding("rows").filter(oFilter);
    }
    if (oTable.bindItems) {
      oTable.getBinding("items").filter(oFilter);
    }

    // This method must be called after binding update of the table.
    oVHD.update();
  });
},

_updateLabelsAndTable: function() {
  this.oExpandedLabel.setText(this.getFormattedSummaryTextExpanded());
  this.oSnappedLabel.setText(this.getFormattedSummaryText());
  this.oTable.setShowOverlay(true);
},

  };
});
