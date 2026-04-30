sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "zapp/utils/GridValidator"
], function (MessageToast, MessageBox, BusyIndicator, GridValidator) {
    "use strict";

    const ACTION_PREVIEW_EXCEL = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.previewExcel(...)";
    const ACTION_SAVE_DB = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
    const ACTION_UPLOAD_EXCEL = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.uploadExcel(...)";

    var UploadExcelData = {
        
        onUploadExcelPress: function (oEvent) {
            var aFiles = oEvent.getParameter("files"),
                oFile = aFiles ? aFiles[0] : null,
                oReader;

            if (!oFile) {
                MessageToast.show("File not found. Please try again!");
                return;
            }

            oReader = new FileReader();
            oReader.onload = function (e) {
                var sDataURL = e.target.result,
                    sBase64String = sDataURL.split(",")[1],
                    sTableName = this.getView().getModel("overall").getProperty("/tableName");

                UploadExcelData._getPreviewData.call(this, sTableName, sBase64String);
                this.byId("excelUploader").clear();
            }.bind(this);

            oReader.readAsDataURL(oFile);
        },

        _getPreviewData: function (sTableName, sBase64String) {
            var oModel = this.getView().getModel(),
                oActionContext = oModel.bindContext(ACTION_PREVIEW_EXCEL),
                oPendingBinding = oModel.bindList("/Data", null, null, [
                    new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "P")
                ]);

            BusyIndicator.show(0);
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            Promise.all([
                oActionContext.execute(),
                oPendingBinding.requestContexts(0, 5000)
            ]).then(function (aResults) {
                var oResult = oActionContext.getBoundContext().getObject(),
                    aPendingContexts = aResults[1] || [],
                    aPendingData = [],
                    sDecodedString, aParsedData;

                BusyIndicator.hide();

                aPendingContexts.forEach(function (ctx) {
                    var oData = ctx.getObject(),
                        sTbl = oData.table_name || oData.TableName || "";
                        
                    if (sTbl.toUpperCase() === sTableName.toUpperCase()) {
                        try {
                            aPendingData.push(JSON.parse(oData.data || oData.Data || "{}"));
                        } catch (e) { }
                    }
                });

                if (oResult && oResult.json_string) {
                    try {
                        sDecodedString = decodeURIComponent(escape(atob(oResult.json_string)));
                        aParsedData = JSON.parse(sDecodedString);
                        UploadExcelData._openPreviewDialog.call(this, sTableName, aParsedData, aPendingData);
                    } catch (e) {
                        MessageBox.error("Preview data reading error: " + e.message);
                    }
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Preview error: " + (oError.message || "Please see Console."));
                console.error(oError);
            });
        },

        _openPreviewDialog: function (sTableName, aData, aPendingData) {
            var oView = this.getView(),
                oDisplayModel = oView.getModel("displayModel"),
                aMeta = oDisplayModel ? oDisplayModel.getProperty("/Meta") : [],
                aOldData = oDisplayModel ? oDisplayModel.getProperty("/Data") : [],
                oJSONModel = new sap.ui.model.json.JSONModel(aData),
                aKeyFields = [],
                oIdCol, oTable, oScrollContainer, oDialog,
                _performFullGridValidation;

            if (aMeta && aMeta.length > 0) {
                aMeta.forEach(function (m) {
                    var sUpperKey = (m.fieldname || m.fieldName || m.name || "").toUpperCase();
                    if (m.keyflag === "X" || m.keyFlag === "X" || m.isKey === true) {
                        aKeyFields.push(sUpperKey);
                    }
                });
                if (aKeyFields.length === 0) {
                    oIdCol = aMeta.find(c => {
                        var name = (c.fieldname || c.fieldName || "").toUpperCase();
                        return name === "ID" || name.includes("_ID");
                    });
                    if (oIdCol) aKeyFields.push((oIdCol.fieldname || oIdCol.fieldName).toUpperCase());
                }
            }

            _performFullGridValidation = function () {
                var aCurrentData = oJSONModel.getData(),
                    aCleanedData = GridValidator.performLiveValidation(aCurrentData, aMeta, aOldData);

                aCleanedData.forEach(function (oRow) {
                    var bHasVal = false, key, bIsDuplicatePending;

                    for (key in oRow) {
                        if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                            if (oRow[key] !== undefined && oRow[key] !== null && String(oRow[key]).trim() !== "") {
                                bHasVal = true;
                            }
                        }
                    }

                    if (bHasVal && aKeyFields.length > 0 && aPendingData && aPendingData.length > 0) {
                        bIsDuplicatePending = false;

                        aPendingData.forEach(function (oPendingRow) {
                            var bMatchAllKeys = true;
                            aKeyFields.forEach(function (kField) {
                                var sVal1 = String(oRow[kField] || "").trim().toUpperCase(),
                                    sVal2 = String(oPendingRow[kField] || oPendingRow[kField.toLowerCase()] || "").trim().toUpperCase();
                                if (sVal1 !== sVal2 || sVal1 === "") {
                                    bMatchAllKeys = false;
                                }
                            });
                            if (bMatchAllKeys) bIsDuplicatePending = true;
                        });

                        if (bIsDuplicatePending) {
                            aKeyFields.forEach(function (kField) {
                                oRow["_state_" + kField] = "Error";
                                oRow["_msg_" + kField] = "Record is currently Pending. Cannot overwrite!";
                            });
                        }
                    }
                });

                oJSONModel.setData(aCleanedData);
            };

            oTable = new sap.ui.table.Table({
                selectionMode: "None",
                visibleRowCount: aData.length,
                alternateRowColors: true
            });

            if (aMeta && aMeta.length > 0) {
                aMeta.forEach(function (colMeta) {
                    var sKey = colMeta.fieldname,
                        sUpperKey = sKey.toUpperCase(),
                        sLabelText = colMeta.scrtextL || colMeta.scrtextM || colMeta.scrtextS || sKey;

                    if (sUpperKey !== "MANDT") {
                        oTable.addColumn(new sap.ui.table.Column({
                            label: new sap.m.Label({ text: sLabelText, design: "Bold" }),
                            template: new sap.m.Input({
                                value: "{" + sUpperKey + "}",
                                valueState: "{_state_" + sUpperKey + "}",
                                valueStateText: "{_msg_" + sUpperKey + "}",
                                change: function () {
                                    _performFullGridValidation();
                                }
                            }),
                            width: "10rem",
                            autoResizable: true
                        }));
                    }
                });
            }

            oTable.setModel(oJSONModel);
            oTable.bindRows("/");
            _performFullGridValidation();

            oScrollContainer = new sap.m.ScrollContainer({
                horizontal: true,
                vertical: true,
                width: "100%",
                height: "100%",
                content: [oTable]
            });

            oDialog = new sap.m.Dialog({
                title: "Check data before uploading - Table " + sTableName + " (" + aData.length + " line)",
                contentWidth: "1200px",
                contentHeight: "600px",
                resizable: true,
                draggable: true,
                content: [oScrollContainer],
                buttons: [
                    new sap.m.Button({
                        text: "Confirm Upload",
                        type: "Emphasized",
                        icon: "sap-icon://upload",
                        press: function () {
                            var oModelInner = this.getView().getModel(),
                                oPendingBindingInner = oModelInner.bindList("/Data", null, null, [
                                    new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "P")
                                ]);

                            sap.ui.core.BusyIndicator.show(0);

                            oPendingBindingInner.requestContexts(0, 5000).then(function (aContexts) {
                                var aFreshPendingData = [],
                                    aCurrentData, bHasError = false, aCleanData = [],
                                    sNewJsonString, sNewBase64String;

                                sap.ui.core.BusyIndicator.hide();

                                aContexts.forEach(function (ctx) {
                                    var oData = ctx.getObject(),
                                        sTbl = oData.table_name || oData.TableName || "";
                                    if (sTbl.toUpperCase() === sTableName.toUpperCase()) {
                                        try {
                                            aFreshPendingData.push(JSON.parse(oData.data || oData.Data || "{}"));
                                        } catch (e) { }
                                    }
                                });

                                aPendingData = aFreshPendingData;
                                _performFullGridValidation();

                                aCurrentData = oJSONModel.getData();

                                aCurrentData.forEach(function (oRow) {
                                    var oCleanRow = {},
                                        bIsEmptyRow = true,
                                        bHasKeyData = true,
                                        bHasOtherData = false,
                                        key, sValue;

                                    for (key in oRow) {
                                        if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                                            sValue = oRow[key];
                                            oCleanRow[key] = sValue;
                                            if (sValue !== undefined && sValue !== null && String(sValue).trim() !== "") {
                                                bIsEmptyRow = false;
                                                if (!aKeyFields.includes(key)) bHasOtherData = true;
                                            }
                                        }
                                    }

                                    if (aKeyFields.length > 0) {
                                        aKeyFields.forEach(function (kField) {
                                            var val = oRow[kField];
                                            if (val === undefined || val === null || String(val).trim() === "") {
                                                bHasKeyData = false;
                                            }
                                        });
                                    }

                                    if (!bIsEmptyRow) {
                                        if (!bHasKeyData && bHasOtherData) {
                                            aKeyFields.forEach(function (kField) {
                                                var val = oRow[kField];
                                                if (val === undefined || val === null || String(val).trim() === "") {
                                                    oRow["_state_" + kField] = "Error";
                                                    oRow["_msg_" + kField] = "Primary Key is required!";
                                                }
                                            });
                                        } else if (bHasKeyData) {
                                            for (key in oRow) {
                                                if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                                                    sValue = oRow[key];
                                                    if (sValue === undefined || sValue === null || String(sValue).trim() === "") {
                                                        oRow["_state_" + key] = "None";
                                                        oRow["_msg_" + key] = "";
                                                    }
                                                }
                                            }
                                        }

                                        for (key in oRow) {
                                            if (key.startsWith("_state_") && oRow[key] === "Error") {
                                                bHasError = true;
                                            }
                                        }

                                        aCleanData.push(oCleanRow);
                                    }
                                });

                                oJSONModel.refresh();

                                if (aCleanData.length === 0) {
                                    MessageBox.warning("There is no valid data to upload. Please check again!");
                                    return;
                                }

                                if (bHasError) {
                                    MessageBox.error("Data conflict detected or format error! Please check the red cells before uploading.");
                                    return;
                                }

                                sNewJsonString = JSON.stringify(aCleanData);
                                sNewBase64String = btoa(unescape(encodeURIComponent(sNewJsonString)));

                                UploadExcelData._sendExcelToBackend.call(this, sTableName, sNewBase64String);
                                oDialog.close();

                            }.bind(this)).catch(function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                MessageBox.error("System error when verifying pending status. Please try again!");
                                console.error(oError);
                            });
                        }.bind(this)
                    }),
                    new sap.m.Button({
                        text: "Cancel",
                        press: function () { oDialog.close(); }
                    })
                ],
                afterClose: function () { oDialog.destroy(); }
            });

            oView.addDependent(oDialog);
            oDialog.open();
        },

        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oView = this.getView(),
                oModel = oView.getModel(),
                oAuthModel = this.getOwnerComponent().getModel("auth"),
                bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false,
                bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false,
                sActionPath = (bIsManager || bIsAdmin) ? ACTION_SAVE_DB : ACTION_UPLOAD_EXCEL,
                oActionContext = oModel.bindContext(sActionPath);

            BusyIndicator.show(0);
            oActionContext.setParameter("table_name", sTableName.toUpperCase());

            if (bIsManager || bIsAdmin) {
                oActionContext.setParameter("json_data", sBase64String);
            } else {
                oActionContext.setParameter("file_content", sBase64String);
            }

            oActionContext.execute().then(function () {
                var sSuccessMsg = (bIsManager || bIsAdmin)
                    ? "Data saved directly to Physical Database!"
                    : "Excel Uploaded successfully! Waiting for approval.";
                
                BusyIndicator.hide();
                MessageToast.show(sSuccessMsg);

                if (typeof this._refreshData === "function") {
                    this._refreshData(sTableName);
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Upload error: " + (oError.message || "Please see Console."));
                console.error(oError);
            });
        }
    };

    return UploadExcelData;
});