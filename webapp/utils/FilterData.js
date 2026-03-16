sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function(Filter, FilterOperator) {
    "use strict";

    return {
        onFilter: function () {
            if (!this._oFilterDialog) {
                this._oFilterDialog = new sap.m.ViewSettingsDialog({
                    title: "Filter",
                    confirm: this.onFilterConfirm.bind(this)
                });
                this.getView().addDependent(this._oFilterDialog);
            }
            
            this._oFilterDialog.removeAllFilterItems();
            
            //Lấy dữ liệu từ /UiData
            var aData = this.getView().getModel("displayModel").getProperty("/UiData");
            
            this._oFieldName.forEach(function (sFieldName, index) {
                var oFilterItem = new sap.m.ViewSettingsFilterItem({
                    key: index.toString(), //Đảm bảo key là chuỗi
                    text: sFieldName
                });
                
                var aUniqueValues = [];
                if (aData) {
                    aData.forEach(function(aRow) {
                        //Đảm bảo cell tồn tại và có giá trị
                        if (aRow[index] && aRow[index].value !== undefined && aRow[index].value !== null) {
                            var sValue = aRow[index].value.toString().trim();
                            if (aUniqueValues.indexOf(sValue) === -1 && sValue !== "") {
                                aUniqueValues.push(sValue);
                            }
                        }
                    });
                }
                
                aUniqueValues.forEach(function(sValue) {
                    oFilterItem.addItem(new sap.m.ViewSettingsItem({
                        key: index + "___" + sValue, 
                        text: sValue
                    }));
                });

                //Chỉ hiện những cột nào thực sự có dữ liệu
                if (aUniqueValues.length > 0) {
                    this._oFilterDialog.addFilterItem(oFilterItem);
                }
            }.bind(this));

            this._oFilterDialog.open();
        },

        onFilterConfirm: function (oEvent) {
            var oTable = this.byId("dataTable"),
                mParams = oEvent.getParameters(),
                oBinding = oTable.getBinding("rows");

            var aSelectedItems = mParams.filterItems;
            
            //Thực hiện filter
            if (aSelectedItems.length === 0) {
                oBinding.filter([]);
            } else {
                var oFilterGroups = {};
                aSelectedItems.forEach(function(oItem) {
                    var aSplit = oItem.getKey().split("___");
                    var sColIndex = aSplit[0];
                    var sValue = aSplit[1];
                    
                    if (!oFilterGroups[sColIndex]) {
                        oFilterGroups[sColIndex] = [];
                    }
                    oFilterGroups[sColIndex].push(sValue.trim());
                });

                var oCustomFilter = new sap.ui.model.Filter({
                    path: "", 
                    test: function(aRow) {
                        if (!aRow || !Array.isArray(aRow)) return false;

                        for (var sColIndex in oFilterGroups) {
                            var aAllowedValues = oFilterGroups[sColIndex]; 
                            var oCell = aRow[sColIndex];
                            
                            if (!oCell) return false;

                            var sCellVal = oCell.value !== undefined && oCell.value !== null ? oCell.value.toString().trim() : "";
                            
                            var bMatch = aAllowedValues.some(function(sAllowed) {
                                return sCellVal === sAllowed; 
                            });

                            if (!bMatch) {
                                return false; 
                            }
                        }
                        return true; 
                    }
                });

                oBinding.filter([oCustomFilter]);
            }

            var iFilteredLength = oBinding.getLength(); //Lấy tổng số dòng hiện có sau khi đã áp dụng filter
            
            var iNewVisibleRows = iFilteredLength === 0 ? 1 : (iFilteredLength < 10 ? iFilteredLength : 10);
            
            //Cập nhật lại trạng thái các nút
            var bHasMore = iFilteredLength > iNewVisibleRows;
            var bHasLess = false;
            
            var oDisplayModel = this.getView().getModel("displayModel");
            oDisplayModel.setProperty("/visibleRowCount", iNewVisibleRows);
            oDisplayModel.setProperty("/hasMore", bHasMore);
            oDisplayModel.setProperty("/hasLess", bHasLess);
        }
    };
});