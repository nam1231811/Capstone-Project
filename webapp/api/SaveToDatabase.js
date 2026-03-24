sap.ui.define([
    "zapp/models/DataFormatter" ,
    "zapp/models/GetData"
], function (DataFormatter, GetData) {
    "use strict";

    return {

    onSaveDB: function (sTableName, oView) {
            var oModel = oView.getModel();
            var aData = oView.getModel("displayModel").getProperty("/Data") || [];
            var dataUpdate = []
            console.log(aData);
            
            if (!sTableName) {
                sap.m.MessageBox.error("Table is unknow");
                return;
            }
        
            var aDataToSave = oView.getModel("displayModel").getProperty("/Data");
        
            if (!aDataToSave || aDataToSave.length === 0) {
                sap.m.MessageToast.show("No data to update");
                return;
            }

            aData.forEach(oRow => {
                var aPromises = {};
                Object.keys(oRow).forEach(key => {
                    if (!isNaN(key)) {
                        var oCell = oRow[key];
                        if (oCell && oCell.fieldname) {
                            aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                        } else {
                            console.warn("On Save" + key + "error");
                        }
                    }
                });
                dataUpdate.push(aPromises)
            });
            console.log(dataUpdate);
            
            var sBase64Data = GetData.encodeFunction(dataUpdate)

            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("json_data", sBase64Data);

            oActionContext.execute().then(function () {
                sap.m.MessageToast.show("Already update to database");
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Something is wrong, try another time: " + (oError.message || "Xem Console"));
                console.error(oError);
            });
        }
    }
});