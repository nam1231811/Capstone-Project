sap.ui.define([
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Filter"
], function (FilterOperator, Filter) {
    "use strict";

    return {

        loadMeta: function (oModel, tableName) {
            var aFilters = [
                new Filter("table_name", FilterOperator.EQ, tableName),
                new sap.ui.model.Filter("IsActiveEntity", "EQ", true)
            ];
            return oModel.bindList("/Meta", null, null, aFilters, {
                $$groupId: "$direct"
            });
        },


        loadData: function (oModel, tableName) {
            var aFilters = [
                new Filter("table_name", FilterOperator.EQ, tableName)
            ];
            return oModel.bindList("/Data", null, null, aFilters, {
                $$groupId: "$direct"
            });
        }
    };
});