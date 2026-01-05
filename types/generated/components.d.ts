import type { Schema, Struct } from '@strapi/strapi';

export interface FilingDependentInfo extends Struct.ComponentSchema {
  collectionName: 'components_filing_dependent_infos';
  info: {
    description: 'Details about dependents';
    displayName: 'Dependent Info';
    icon: 'users';
  };
  attributes: {
    birthDate: Schema.Attribute.Date;
    firstName: Schema.Attribute.String;
    lastName: Schema.Attribute.String;
    middleName: Schema.Attribute.String;
    relationship: Schema.Attribute.String;
    sin: Schema.Attribute.String & Schema.Attribute.Private;
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
    birthDate: Schema.Attribute.Date;
    firstName: Schema.Attribute.String;
    incomeOutsideCanada: Schema.Attribute.Enumeration<['Yes', 'No']>;
    lastName: Schema.Attribute.String;
    middleName: Schema.Attribute.String;
    netIncome: Schema.Attribute.Decimal;
    phoneNumber: Schema.Attribute.String;
    residencyStatus: Schema.Attribute.Enumeration<['Resident', 'Non-Resident']>;
    sin: Schema.Attribute.String & Schema.Attribute.Private;
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
      'filing.dependent-info': FilingDependentInfo;
      'filing.spouse-info': FilingSpouseInfo;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
    }
  }
}
