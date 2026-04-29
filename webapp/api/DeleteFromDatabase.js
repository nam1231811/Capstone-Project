sap.ui.define([
    "sap/m/MessageBox",
    "zapp/utils/DataFormatter"
], function (MessageBox, DataFormatter) {
    "use strict";
    const DELETE_CLERK_PATH = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteActiveRecord(...)";
    const DELETE_ADMIN_PATH = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteFromDatabase(...)";
    return {
        onDeleteFromDatabase: function (sTableName, oView, vCustomData) {
            var sActionPath = DELETE_ADMIN_PATH;
            return this._executeDelete(sActionPath, sTableName, oView, vCustomData);
        },

        onDeleteActiveRecord: function (sTableName, oView, vCustomData) {
            var sActionPath = DELETE_CLERK_PATH;
            return this._executeDelete(sActionPath, sTableName, oView, vCustomData);
        },

        _executeDelete: function (sActionPath, sTableName, oView, vCustomData) {
            var oModel = oView.getModel();

            if (!sTableName) {
                MessageBox.error("Table is unknown");
                return Promise.reject(new Error("Table is unknown"));
            }

            if (!vCustomData || vCustomData.length === 0) {
                return Promise.reject(new Error("No data to delete"));
            }

            var aPromises = {};
            var aCells = Object.values(vCustomData);
            
            aCells.forEach(function(oCell) {
                if (oCell && oCell.fieldname) {
                    aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                }
            });

            var sBase64Data = DataFormatter.encodeFunction(aPromises);
            var oActionContext = oModel.bindContext(sActionPath);
            
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("data", sBase64Data);

            sap.ui.getCore().getMessageManager().removeAllMessages();

            return oActionContext.execute().then(function () {
                return aCells;
            }).catch(function (oError) {
                var sFinalError = oError.message || "This record is pending for approval.";
                if (oError && oError.error && oError.error.message) {
                    sFinalError = oError.error.message.value || oError.error.message;
                }
                throw new Error(sFinalError);
            });
        }
    };
});