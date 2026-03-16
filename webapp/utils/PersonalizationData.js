sap.ui.define([], function() {
    "use strict";

    return {
        onPersonalization: function () {
            var that = this;
            var oTable = this.byId("dataTable");
            var aColumns = oTable.getColumns(); 

            if (!this._oPersoDialog) {
                this._oPersoDialog = new sap.m.Dialog({
                    title: "Personalization",
                    contentWidth: "400px",
                    contentHeight: "450px",
                    resizable: true,
                    draggable: true,
                    content: new sap.m.List({
                        mode: sap.m.ListMode.MultiSelect,
                        includeItemInSelection: true
                    }),
                    beginButton: new sap.m.Button({
                        type: "Emphasized",
                        text: "Save",
                        press: function () {
                            var oList = that._oPersoDialog.getContent()[0];
                            var aItems = oList.getItems();
                            var aSavedCols = [];

                            aItems.forEach(function(oItem, index) {
                                var bSelected = oItem.getSelected();
                                var oColumn = aColumns[index];
                                
                                oColumn.setVisible(bSelected); 

                                aSavedCols.push({
                                    index: index,
                                    visible: bSelected
                                });
                            });

                            var sTableName = that.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
                            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
                            window.localStorage.setItem(sStorageKey, JSON.stringify(aSavedCols));

                            that._oPersoDialog.close();
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oPersoDialog.close();
                        }
                    })
                });
                this.getView().addDependent(this._oPersoDialog);
            }

            var oList = this._oPersoDialog.getContent()[0];
            oList.removeAllItems();
            
            aColumns.forEach(function(oColumn, index) {
                var oHeaderControl = oColumn.getLabel();
                var sText = "Column " + index;
                if (oHeaderControl && typeof oHeaderControl.getText === "function") {
                    sText = oHeaderControl.getText();
                }
                
                var oItem = new sap.m.StandardListItem({
                    title: sText,
                    selected: oColumn.getVisible()
                });
                oList.addItem(oItem);
            });

            this._oPersoDialog.open();
        }
    };
});