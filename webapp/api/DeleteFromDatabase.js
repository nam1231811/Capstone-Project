sap.ui.define([], function () {
    "use strict";

    return {
        postDelete: function (tableName, data, sUuid) {
            var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";            
            
            return this._getCsrfToken().then(function(sCsrfToken) {
                var sDeleteUrl = sBaseUrl 
                    + "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteActiveRecord";

                return fetch(sDeleteUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": sCsrfToken,
                    },
                    body: JSON.stringify({
                        "table_name": tableName,
                        "data": data
                    })
                }).then(function(oResponse) {
                    if (oResponse.ok) {
                        return true;
                    }
                    
                    throw new Error("HTTP " + oResponse.status + " - Lỗi xóa dữ liệu từ Backend!");
                });
            }.bind(this));
        },

        _getCsrfToken: function() {
            var sBaseUrl = "/sap/opu/odata4/sap/zsb_dynamic_meta/srvd/sap/zsd_dynamic_meta/0001";
            return fetch(sBaseUrl + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            }).then(oResponse => {
                if (!oResponse.ok) {
                    throw new Error("Cannot fetch CSRF Token");
                }
                return oResponse.headers.get("X-CSRF-Token");
            });
        },

        
    onDeleteActive: function (sTableName, oView) {
            var oModel = oView.getModel();
            var aData = oView.getModel("displayModel").getProperty("/Data") || [];
            var dataUpdate = []
            
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
            
            var sBase64Data = GetData.encodeFunction(dataUpdate)

            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("json_data", sBase64Data);

            return oActionContext.execute().then(function () {
                sap.m.MessageToast.show("Already update to database");
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Something is wrong, try another time: " + (oError.message || "Xem Console"));
                console.error(oError);
            });
        }
    };
});