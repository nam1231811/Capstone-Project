sap.ui.define([
    "zapp/models/DataFormatter" ,
    "zapp/models/GetData"
], function (DataFormatter, GetData) {
    "use strict";

    return {
        onSaveDB: function (sTableName, oView, aCustomData) {
            var oModel = oView.getModel();
            
            var aData = aCustomData || oView.getModel("displayModel").getProperty("/Data") || [];
            var dataUpdate = [];
            
            if (!sTableName) {
                sap.m.MessageBox.error("Table is unknown");
                return Promise.reject(new Error("Table is unknown"));
            }
        
            if (!aData || aData.length === 0) {
                sap.m.MessageToast.show("No data to update");
                return Promise.reject(new Error("No data to update"));
            }

            aData.forEach(oRow => {
                var aPromises = {};
                Object.keys(oRow).forEach(key => {
                    if (!isNaN(key)) {
                        var oCell = oRow[key];
                        if (oCell && oCell.fieldname) {
                            aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                        } else {
                            console.warn("On Save " + key + " error");
                        }
                    }
                });
                dataUpdate.push(aPromises)
            });
            
            var sBase64Data = GetData.encodeFunction(dataUpdate);

            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("json_data", sBase64Data);

            return oActionContext.execute().then(function () {
            }).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Database error: " + oError.message);
                console.error(oError);
                throw oError; 
            });
        }
    }
});