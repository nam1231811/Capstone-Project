sap.ui.define([
    "zapp/utils/DataFormatter"
], function (DataFormatter) {
    "use strict";

    return {
        onSaveDB: function (sTableName, oView, vCustomData) {
            var oModel = oView.getModel();
            var sBase64Data = "";
            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";

            if (!sTableName) {
                sap.m.MessageBox.error("Table is unknown");
                return Promise.reject(new Error("Table is unknown"));
            }

            if (typeof vCustomData === "string") {
                sBase64Data = vCustomData;
            } else {
                var aData = vCustomData || oView.getModel("displayModel").getProperty("/Data") || [];
                var dataUpdate = [];

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

                sBase64Data = DataFormatter.encodeFunction(dataUpdate);
            }

            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("json_data", sBase64Data);

            sap.ui.getCore().getMessageManager().removeAllMessages();

            return oActionContext.execute().then(function () {
                var bHasError = false;
                var sBackendErrMsg = "System error while saving data";

                var oResult = oActionContext.getBoundContext().getObject();
                if (oResult && oResult.json_string) {
                    try {
                        var oResData = JSON.parse(oResult.json_string);
                        if (oResData.status === "error") {
                            bHasError = true;
                            if (oResData.message) {
                                sBackendErrMsg = oResData.message
                            };
                        }
                    } catch (e) { }
                }

                var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                var aErrors = aMessages.filter(function (m) { return m.type === "Error"; });
                if (aErrors.length > 0) {
                    bHasError = true;
                    sBackendErrMsg = aErrors[aErrors.length - 1].message;
                }

                if (bHasError) {
                    sap.ui.getCore().getMessageManager().removeAllMessages();
                    throw new Error(sBackendErrMsg);
                }

            }).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                var sFinalError = oError.message || "Unknown Database Error";
                if (oError && oError.error && oError.error.message) {
                    sFinalError = oError.error.message.value || oError.error.message;
                }
                sap.m.MessageBox.error(sFinalError, { 
                    title: "Cannot save data" 
                });
                throw new Error(sFinalError);
            });
        }
    }
});