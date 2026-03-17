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
            var that = this;
            var oTable = this.byId("dataTable");
            var aColumns = oTable.getColumns();

            //Lấy index của cột từ CustomData
            var getColIndex = function(oCol) {
                var aCustomData = oCol.getCustomData();
                var oData = aCustomData.find(function(d) { return d.getKey() === "colIndex"; });
                return oData ? parseInt(oData.getValue(), 10) : -1;
            };

            if (!this._oPersoDialog) {
                this._oPersoList = new List({
                    mode: "MultiSelect"
                });

                this._oPersoDialog = new Dialog({
                    title: "Personalization",
                    contentWidth: "300px",
                    content: [this._oPersoList],
                    beginButton: new Button({
                        type: "Emphasized",
                        text: "OK",
                        press: function () {
                            //Lấy danh sách các cột được tích
                            var aSelectedItems = that._oPersoList.getSelectedItems();
                            var aPersoState = [];
                            
                            //Ẩn tất cả đi
                            aColumns.forEach(function (oCol) {
                                oCol.setVisible(false);
                            });

                            //Hiện lại những cột được tích
                            aSelectedItems.forEach(function (oItem) {
                                var iItemKey = parseInt(oItem.data("colIndex"), 10);
                                var oTargetCol = aColumns.find(function(c) { return getColIndex(c) === iItemKey; });
                                if (oTargetCol) {
                                    oTargetCol.setVisible(true);
                                }
                            });

                            //Quét lại để lấy trạng thái mới nhất
                            aColumns.forEach(function(oCol) {
                                aPersoState.push({
                                    index: getColIndex(oCol),
                                    visible: oCol.getVisible()
                                });
                            });

                            //Lưu vào local storage
                            var sTableName = that.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
                            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
                            
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
                        press: function () {
                            that._oPersoDialog.close();
                        }
                    })
                });
                this.getView().addDependent(this._oPersoDialog);
            }

            this._oPersoList.removeAllItems();

            //Nạp lại danh sách cột hiện tại vào list
            aColumns.forEach(function (oCol) {
                var sColName = oCol.getLabel() ? oCol.getLabel().getText() : "Column";
                var iColIndex = getColIndex(oCol);

                if (iColIndex !== -1) {
                    var oItem = new StandardListItem({
                        title: sColName,
                        selected: oCol.getVisible()
                    });
                    
                    oItem.data("colIndex", iColIndex.toString());
                    
                    this._oPersoList.addItem(oItem);
                }
            }.bind(this));

            this._oPersoDialog.open();
        }
    };
});