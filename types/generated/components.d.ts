import type { Schema, Struct } from '@strapi/strapi';

export interface FilingCapitalAsset extends Struct.ComponentSchema {
  collectionName: 'components_filing_capital_assets';
  info: {
    description: 'Used in Self-Employment and Rental Income';
    displayName: 'Capital Asset';
  };
  attributes: {
    assetName: Schema.Attribute.String;
    cost: Schema.Attribute.Decimal;
    purchaseDate: Schema.Attribute.Date;
  };
}

export interface FilingDependentInfo extends Struct.ComponentSchema {
  collectionName: 'components_filing_dependent_infos';
  info: {
    description: 'Details about dependents';
    displayName: 'Dependent Info';
    icon: 'users';
  };
  attributes: {
    becameResidentThisYear: Schema.Attribute.Enumeration<['YES', 'NO']>;
    birthDate: Schema.Attribute.Date;
    dateBecameResident: Schema.Attribute.Date;
    deductions: Schema.Attribute.JSON;
    earnsIncome: Schema.Attribute.Enumeration<['YES', 'NO']>;
    firstName: Schema.Attribute.String;
    incomeSources: Schema.Attribute.JSON;
    lastName: Schema.Attribute.String;
    middleName: Schema.Attribute.String;
    netIncome: Schema.Attribute.Decimal;
    relationship: Schema.Attribute.String;
    sin: Schema.Attribute.String & Schema.Attribute.Private;
    statusInCanada: Schema.Attribute.Enumeration<
      [
        'CANADIAN_CITIZEN',
        'PERMANENT_RESIDENT',
        'TEMPORARY_RESIDENT',
        'PROTECTED_PERSON',
      ]
    >;
    taxSlips: Schema.Attribute.JSON;
    workExpenses: Schema.Attribute.JSON;
  };
}

export interface FilingDisabilityCredit extends Struct.ComponentSchema {
  collectionName: 'components_filing_disability_credits';
  info: {
    description: '';
    displayName: 'Disability Credit';
  };
  attributes: {
    affectedPersons: Schema.Attribute.JSON;
    dependantName: Schema.Attribute.String;
  };
}

export interface FilingElectionsCanada extends Struct.ComponentSchema {
  collectionName: 'components_filing_elections_canadas';
  info: {
    description: '';
    displayName: 'Elections Canada';
  };
  attributes: {
    authorizeCRA: Schema.Attribute.Boolean;
    consentRegister: Schema.Attribute.Boolean;
  };
}

export interface FilingHomeOffice extends Struct.ComponentSchema {
  collectionName: 'components_filing_home_offices';
  info: {
    description: '';
    displayName: 'Home Office';
  };
  attributes: {
    monthlyCleaningSupplies: Schema.Attribute.Decimal;
    monthlyElectricity: Schema.Attribute.Decimal;
    monthlyHeat: Schema.Attribute.Decimal;
    monthlyInsurance: Schema.Attribute.Decimal;
    monthlyInternet: Schema.Attribute.Decimal;
    monthlyMinorRepairs: Schema.Attribute.Decimal;
    monthlyMortgageInterest: Schema.Attribute.Decimal;
    monthlyOtherMaintenance: Schema.Attribute.Decimal;
    monthlyOtherUtilities: Schema.Attribute.Decimal;
    monthlyPropertyTax: Schema.Attribute.Decimal;
    monthlyRent: Schema.Attribute.Decimal;
    monthlyWater: Schema.Attribute.Decimal;
    otherExpensesAmount: Schema.Attribute.Decimal;
    otherExpensesDescription: Schema.Attribute.String;
    otherUtilitiesDescription: Schema.Attribute.String;
    totalHomeSize: Schema.Attribute.Decimal;
    workAreaSize: Schema.Attribute.Decimal;
  };
}

export interface FilingMovingExpenses extends Struct.ComponentSchema {
  collectionName: 'components_filing_moving_expenses';
  info: {
    description: '';
    displayName: 'Moving Expenses';
  };
  attributes: {
    homeExpenses: Schema.Attribute.JSON;
    kmDrivenForMoving: Schema.Attribute.Decimal;
    moveDate: Schema.Attribute.Date;
    newAddress: Schema.Attribute.String;
    newCityProvince: Schema.Attribute.String;
    oldAddress: Schema.Attribute.String;
    oldCityProvince: Schema.Attribute.String;
    otherExpenses: Schema.Attribute.JSON;
    reason: Schema.Attribute.String;
    tempLivingExpenses: Schema.Attribute.JSON;
    transportExpenses: Schema.Attribute.JSON;
    travelExpenses: Schema.Attribute.JSON;
    usedVehicle: Schema.Attribute.Boolean;
    vehicleInfo: Schema.Attribute.String;
    workStartDate: Schema.Attribute.Date;
  };
}

export interface FilingPropertyAssets extends Struct.ComponentSchema {
  collectionName: 'components_filing_property_assets';
  info: {
    description: '';
    displayName: 'Property Assets';
  };
  attributes: {
    disposedPrincipalResidence: Schema.Attribute.Boolean;
    foreignAffiliate: Schema.Attribute.Boolean;
    foreignPropertyOver100k: Schema.Attribute.Boolean;
    purchasedPrincipalResidence: Schema.Attribute.Boolean;
  };
}

export interface FilingRentOrPropertyTax extends Struct.ComponentSchema {
  collectionName: 'components_filing_rent_or_property_taxes';
  info: {
    description: 'Rent or property tax payment details';
    displayName: 'Rent or Property Tax';
    icon: 'home';
  };
  attributes: {
    amount: Schema.Attribute.Decimal;
    endDate: Schema.Attribute.Date;
    fullAddress: Schema.Attribute.String;
    residencyType: Schema.Attribute.Enumeration<['RENT', 'OWNED']>;
    startDate: Schema.Attribute.Date;
  };
}

export interface FilingRentalIncome extends Struct.ComponentSchema {
  collectionName: 'components_filing_rental_incomes';
  info: {
    description: '';
    displayName: 'Rental Income';
  };
  attributes: {
    buildingValue: Schema.Attribute.Decimal;
    claimCCA: Schema.Attribute.Boolean;
    equipment: Schema.Attribute.Component<'filing.capital-asset', true>;
    expenseAmounts: Schema.Attribute.JSON;
    expenseCategories: Schema.Attribute.JSON;
    otherRentalIncome: Schema.Attribute.Decimal;
    ownershipPercentage: Schema.Attribute.Decimal;
    personalUse: Schema.Attribute.Boolean;
    priorCCAClaimed: Schema.Attribute.Decimal;
    propertyAddress: Schema.Attribute.String;
    propertyType: Schema.Attribute.String;
    purchaseDate: Schema.Attribute.Date;
    purchasePrice: Schema.Attribute.Decimal;
    rentalAreaSize: Schema.Attribute.Decimal;
    rentalStartDate: Schema.Attribute.Date;
    rentedFullYear: Schema.Attribute.Boolean;
    totalHomeSize: Schema.Attribute.Decimal;
    totalRentReceived: Schema.Attribute.Decimal;
  };
}

export interface FilingSelfEmployment extends Struct.ComponentSchema {
  collectionName: 'components_filing_self_employments';
  info: {
    description: '';
    displayName: 'Self Employment';
  };
  attributes: {
    capitalAssets: Schema.Attribute.Component<'filing.capital-asset', true>;
    expenseAmounts: Schema.Attribute.JSON;
    expenseCategories: Schema.Attribute.JSON;
    gstNumber: Schema.Attribute.String;
    gstRegistered: Schema.Attribute.Boolean;
    hasCapitalAssets: Schema.Attribute.Boolean;
    hasHomeOffice: Schema.Attribute.Boolean;
    homeOfficeExpenses: Schema.Attribute.JSON;
    needsBookkeeping: Schema.Attribute.String;
    usesVehicleForBusiness: Schema.Attribute.Boolean;
    vehicleForBusiness: Schema.Attribute.JSON;
  };
}

export interface FilingSpouseInfo extends Struct.ComponentSchema {
  collectionName: 'components_filing_spouse_infos';
  info: {
    description: 'Details about the spouse';
    displayName: 'Spouse Info';
    icon: 'user';
  };
  attributes: {
    apartmentNumber: Schema.Attribute.String;
    becameResidentThisYear: Schema.Attribute.Enumeration<['YES', 'NO']>;
    birthDate: Schema.Attribute.Date;
    city: Schema.Attribute.String;
    dateBecameResident: Schema.Attribute.Date;
    deductions: Schema.Attribute.JSON;
    email: Schema.Attribute.Email;
    firstName: Schema.Attribute.String;
    incomeSources: Schema.Attribute.JSON;
    lastName: Schema.Attribute.String;
    middleName: Schema.Attribute.String;
    netIncome: Schema.Attribute.Decimal;
    phoneNumber: Schema.Attribute.String;
    postalCode: Schema.Attribute.String;
    province: Schema.Attribute.Enumeration<
      [
        'AB',
        'BC',
        'MB',
        'NB',
        'NL',
        'NS',
        'NT',
        'NU',
        'ON',
        'PE',
        'QC',
        'SK',
        'YT',
      ]
    >;
    sameAddress: Schema.Attribute.Enumeration<['YES', 'NO']>;
    sin: Schema.Attribute.String & Schema.Attribute.Private;
    statusInCanada: Schema.Attribute.Enumeration<
      [
        'CANADIAN_CITIZEN',
        'PERMANENT_RESIDENT',
        'TEMPORARY_RESIDENT',
        'PROTECTED_PERSON',
      ]
    >;
    streetName: Schema.Attribute.String;
    streetNumber: Schema.Attribute.String;
    taxSlips: Schema.Attribute.JSON;
    workExpenses: Schema.Attribute.JSON;
  };
}

export interface FilingVehicleExpenses extends Struct.ComponentSchema {
  collectionName: 'components_filing_vehicle_expenses';
  info: {
    description: '';
    displayName: 'Vehicle Expenses';
  };
  attributes: {
    annualFuel: Schema.Attribute.Decimal;
    annualInsurance: Schema.Attribute.Decimal;
    annualLease: Schema.Attribute.Decimal;
    annualLicense: Schema.Attribute.Decimal;
    annualLoanInterest: Schema.Attribute.Decimal;
    annualMaintenance: Schema.Attribute.Decimal;
    annualOther: Schema.Attribute.Decimal;
    annualParking: Schema.Attribute.Decimal;
    annualRides: Schema.Attribute.Decimal;
    kmDrivenForWork: Schema.Attribute.Decimal;
    kmDrivenThisYear: Schema.Attribute.Decimal;
    make: Schema.Attribute.String;
    model: Schema.Attribute.String;
    notApplicable: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    purchaseCost: Schema.Attribute.Decimal;
    purchaseDate: Schema.Attribute.Date;
    totalKmDriven: Schema.Attribute.Decimal;
    uccStartOfYear: Schema.Attribute.Decimal;
    year: Schema.Attribute.Integer;
  };
}

export interface FilingWorkExpenses extends Struct.ComponentSchema {
  collectionName: 'components_filing_work_expenses';
  info: {
    description: '';
    displayName: 'Work Expenses';
  };
  attributes: {
    categories: Schema.Attribute.JSON;
    expenseTypes: Schema.Attribute.JSON;
    suppliesReceipts: Schema.Attribute.Media<'files' | 'images', true>;
    t2200Document: Schema.Attribute.Media<'files' | 'images', true>;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'filing.capital-asset': FilingCapitalAsset;
      'filing.dependent-info': FilingDependentInfo;
      'filing.disability-credit': FilingDisabilityCredit;
      'filing.elections-canada': FilingElectionsCanada;
      'filing.home-office': FilingHomeOffice;
      'filing.moving-expenses': FilingMovingExpenses;
      'filing.property-assets': FilingPropertyAssets;
      'filing.rent-or-property-tax': FilingRentOrPropertyTax;
      'filing.rental-income': FilingRentalIncome;
      'filing.self-employment': FilingSelfEmployment;
      'filing.spouse-info': FilingSpouseInfo;
      'filing.vehicle-expenses': FilingVehicleExpenses;
      'filing.work-expenses': FilingWorkExpenses;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
    }
  }
}
