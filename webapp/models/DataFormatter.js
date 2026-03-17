sap.ui.define([
], function () {
    "use strict";

    return {
        groupDataByRow: function (data) {
            if (!data || !Array.isArray(data)) {
                return [];
            }

            const groupData = data.reduce(function (acc, obj) {
                var sKey = obj.row_id;
                if (!acc[sKey]) {
                    acc[sKey] = [];
                }
                acc[sKey].push(obj);
                return acc;
            }, {});

            return Object.values(groupData);
        },

        formatJson: function (sJsonString) {
            if (!sJsonString || sJsonString === "") {
                return "No Data (Blank)";
            }
            try {
                var oJson = JSON.parse(sJsonString);
                return JSON.stringify(oJson, null, 4);
            } catch (e) {
                return sJsonString;
            }
        },

        mapDataForDisplay: function (aDataRaw, aFieldName) {
            return aDataRaw.map(record => {
                return aFieldName.map(nameColumn => {
                    const cell = record.find(column => column.fieldname === nameColumn);
                    return cell || { value: "" };
                });
            });
        }
    };
});