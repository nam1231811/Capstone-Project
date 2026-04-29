sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/MessageToast"
], function (Dialog, Button, List, StandardListItem, MessageToast) {
    "use strict";

    return {
        onPersonalization: function () {
            var oView = this.getView(),
                oTable = this.byId("dataTable"),
                aColumns = oTable ? oTable.getColumns() : [],
                oOverallModel = oView.getModel("overall"),
                sTableName = oOverallModel ? oOverallModel.getProperty("/tableName") : "DefaultTable",
                sStorageKey = "myApp_" + sTableName + "_GridPerso",
                that = this;

            var getColIndex = function (oCol) {
                var oData = oCol.getCustomData().find(function (d) { return d.getKey() === "colIndex"; });
                return oData ? parseInt(oData.getValue(), 10) : -1;
            };

            if (!this._oPersoDialog) {
                this._oPersoList = new List({ mode: "MultiSelect" });

                this._oPersoDialog = new Dialog({
                    title: "Personalization",
                    contentWidth: "300px",
                    content: [this._oPersoList],
                    beginButton: new Button({
                        type: "Emphasized",
                        text: "OK",
                        press: function () {
                            var aSelectedItems = that._oPersoList.getSelectedItems(),
                                aSelectedIndexes = aSelectedItems.map(function (oItem) { return parseInt(oItem.data("colIndex"), 10); }),
                                aPersoState = [];

                            aColumns.forEach(function (oCol) {
                                var iColIdx = getColIndex(oCol),
                                    bVisible = aSelectedIndexes.indexOf(iColIdx) !== -1;
                                
                                oCol.setVisible(bVisible);
                                aPersoState.push({ index: iColIdx, visible: bVisible });
                            });

                            try {
                                window.localStorage.setItem(sStorageKey, JSON.stringify(aPersoState));
                                MessageToast.show("Saved!");
                            } catch (e) {
                                console.error("Error!:", e);
                            }

                            that._oPersoDialog.close();
                        }
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: function () { that._oPersoDialog.close(); }
                    })
                });
                oView.addDependent(this._oPersoDialog);
            }

            this._oPersoList.removeAllItems();

            aColumns.forEach(function (oCol) {
                var iColIndex = getColIndex(oCol);
                
                if (iColIndex !== -1) {
                    that._oPersoList.addItem(new StandardListItem({
                        title: oCol.getLabel() ? oCol.getLabel().getText() : "Column",
                        selected: oCol.getVisible()
                    }).data("colIndex", iColIndex.toString()));
                }
            });

            this._oPersoDialog.open();
        }
    };
});