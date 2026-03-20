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

        generateUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }).toUpperCase();
        },

        mapDataForDisplay: function (aDataRaw, aFieldName) {
            return aDataRaw.map(record => {
               var oRowObject = {}; 
               aFieldName.forEach((nameColumn, iIndex) => {
                   const cell = record.find(column => column.fieldname === nameColumn);

                   oRowObject[iIndex] = cell || { value: "" }; 
               });
               return oRowObject; 
           })
        }
    };
});