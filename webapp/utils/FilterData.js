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
            var aData = this.getView().getModel("displayModel").getProperty("/Data");
            
            this._oFieldName.forEach(function (sFieldName, index) {
                var oFilterItem = new sap.m.ViewSettingsFilterItem({
                    key: index,
                    text: sFieldName
                });
                
                var aUniqueValues = [];
                if (aData) {
                    aData.forEach(function(aRow) {
                        if (aRow[index] && aRow[index].value) {
                            var sValue = aRow[index].value.toString();
                            if (aUniqueValues.indexOf(sValue) === -1) {
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

                this._oFilterDialog.addFilterItem(oFilterItem);
            }.bind(this));

            this._oFilterDialog.open();
        },

        onFilterConfirm: function (oEvent) {
            var oTable = this.byId("dataTable"),
                mParams = oEvent.getParameters(),
                oBinding = oTable.getBinding("rows");

            var aSelectedItems = mParams.filterItems;
            if (aSelectedItems.length === 0) {
                oBinding.filter([]);
                return;
            }

            var oFilterGroups = {};
            aSelectedItems.forEach(function(oItem) {
                var aSplit = oItem.getKey().split("___");
                var sColIndex = aSplit[0];
                var sValue = aSplit[1];
                
                if (!oFilterGroups[sColIndex]) {
                    oFilterGroups[sColIndex] = [];
                }
                oFilterGroups[sColIndex].push(new Filter(sColIndex + "/value", FilterOperator.EQ, sValue)); 
            });

            var aAndFilters = [];
            for (var key in oFilterGroups) {
                if (oFilterGroups[key].length > 1) {
                    aAndFilters.push(new Filter({filters: oFilterGroups[key], and: false})); 
                } else {
                    aAndFilters.push(oFilterGroups[key][0]);
                }
            }

            var oFinalFilter = new Filter({filters: aAndFilters, and: true}); 
            oBinding.filter([oFinalFilter]);
        }
    };
});