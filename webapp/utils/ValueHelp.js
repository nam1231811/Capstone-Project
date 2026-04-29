sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";

    return {
        openTableValueHelp: function (oController, oConfig) {
            var oView = oController.getView();
            var oBundle = oView.getModel("i18n") ? oView.getModel("i18n").getResourceBundle() : null;

            if (!oController._pValueHelpDialog) {
                oController._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: oBundle.getText("listTableTitle"), 
                    busyIndicatorDelay: 0, 
                    noDataText: oBundle.getText("noDataText"), 
                    contentWidth: "50%",
                    growing: true,                           
                    growingThreshold: 20,

                    search: function (oEvt) {
                        var sValue = oEvt.getParameter("value");
                        var oFilter = new sap.ui.model.Filter({
                            filters: [
                                new sap.ui.model.Filter("TableName", FilterOperator.Contains, sValue),
                                new sap.ui.model.Filter("Description", FilterOperator.Contains, sValue)
                            ],
                            and: false
                        });
                        oEvt.getSource().getBinding("items").filter([oFilter]);
                    },

                    confirm: function (oEvt) {
                        var oSelectedItem = oEvt.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sName = oSelectedItem.getCells()[0].getTitle();
                            var sDesc = oSelectedItem.getCells()[1].getText();
                            var oCurrentConfig = oController._pValueHelpDialog.data("config");

                            if (oCurrentConfig.inputId) {
                                oController.byId(oCurrentConfig.inputId).setValue(sName);
                            }
                            if (oCurrentConfig.descInputId) {
                                oController.byId(oCurrentConfig.descInputId).setValue(sDesc);
                            }

                            if (oCurrentConfig.callback && typeof oCurrentConfig.callback === "function") {
                                oCurrentConfig.callback.call(oController, sName, sDesc); 
                            }
                        }
                    },

                    columns: [
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle.getText("tableName"), design: "Bold" }) 
                        }),
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle.getText("tableDesc"), design: "Bold" }),
                            minScreenWidth: "Tablet", 
                            demandPopin: true         
                        })
                    ]
                });

                oView.addDependent(oController._pValueHelpDialog);
                
                oController._pValueHelpDialog.bindAggregation("items", {
                    path: "/TableLookup",
                    template: new sap.m.ColumnListItem({
                        type: "Active",
                        cells: [
                            new sap.m.ObjectIdentifier({ 
                                title: "{TableName}" 
                            }),
                            new sap.m.Text({ 
                                text: "{Description}", 
                                wrapping: true 
                            })
                        ]
                    })
                });
            }

            oController._pValueHelpDialog.data("config", oConfig);

            var oBinding = oController._pValueHelpDialog.getBinding("items");
            if (oBinding) { 
                oBinding.filter([]); 
            }
            if (oController._pValueHelpDialog._oSearchField) { 
                oController._pValueHelpDialog._oSearchField.setValue(""); 
            }

            oController._pValueHelpDialog.open();
        }
    };
});